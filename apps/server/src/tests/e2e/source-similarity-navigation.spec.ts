import {
	E2E_PRIMARY_MEDIA_ID,
	E2E_PRIMARY_FILE_NAME,
	E2E_SIMILAR_MEDIA_ID,
	E2E_SIMILAR_FILE_NAME,
	E2E_SOURCE_ID,
	sourcePath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

/** Exercise query ownership without depending on vector extraction: the backend
 * is represented by two known indexed results, while actual route/store/query
 * transitions, request bodies, cancellation and F5 restoration remain real.
 */
test("source similarity stays scoped and Find Similar hands off one global request without a transient source request", async ({
	page,
}) => {
	// Preserve oRPC's date metadata by using complete one-result wire responses.
	const [primaryResult, similarResult] = await Promise.all(
		[E2E_PRIMARY_FILE_NAME, E2E_SIMILAR_FILE_NAME].map(async (fileName) => {
			const response = await page.request.post("/api/rpc/media/search", {
				data: {
					json: {
						sourceId: E2E_SOURCE_ID,
						params: {
							condition: {
								type: "group",
								operator: "and",
								children: [
									{
										type: "criterion",
										target: "fileName",
										operator: "equals",
										value: fileName,
									},
								],
							},
							limit: 20,
							offset: 0,
						},
					},
				},
			});
			expect(response.ok()).toBe(true);
			const payload = await response.json();
			expect(payload.json.total).toBe(1);
			return {
				...payload,
				json: {
					...payload.json,
					scores: [{ mediaId: payload.json.media[0].id, cosineDistance: 0.1 }],
				},
			};
		}),
	);
	const requests: Array<{ anchorMediaId: string; mediaSourceId?: string }> = [];
	await page.route("**/api/rpc/media/searchSimilar", async (route) => {
		const { json: input } = route.request().postDataJSON();
		requests.push(input);
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(
				input.anchorMediaId === E2E_PRIMARY_MEDIA_ID
					? similarResult
					: primaryResult,
			),
		});
	});
	await page.goto(sourcePath());
	await waitForAppHydration(page);
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible();
	const sourceResponse = page.waitForResponse(
		(response) =>
			response.url().endsWith("/api/rpc/media/searchSimilar") && response.ok(),
	);
	await page
		.locator("#search-composer")
		.fill(`similar:${E2E_PRIMARY_MEDIA_ID}`);
	await page.locator("#search-composer").press("Enter");
	await sourceResponse;
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_SIMILAR_FILE_NAME) }),
	).toBeVisible();
	expect(requests).toEqual([
		expect.objectContaining({
			anchorMediaId: E2E_PRIMARY_MEDIA_ID,
			mediaSourceId: E2E_SOURCE_ID,
		}),
	]);

	await page.reload();
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_SIMILAR_FILE_NAME) }),
	).toBeVisible();
	expect(requests).toHaveLength(2);
	expect(requests[1].mediaSourceId).toBe(E2E_SOURCE_ID);
	requests.length = 0;
	await page
		.locator(`[data-media-id="${E2E_SIMILAR_MEDIA_ID}"]`)
		.click({ button: "right" });
	const globalResponse = page.waitForResponse(
		(response) =>
			response.url().endsWith("/api/rpc/media/searchSimilar") && response.ok(),
	);
	await page.getByRole("menuitem", { name: "類似度検索", exact: true }).click();
	await globalResponse;
	await expect(page).toHaveURL(/\/search(?:\?.*)?$/);
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible();
	expect(requests).toEqual([
		expect.objectContaining({ anchorMediaId: E2E_SIMILAR_MEDIA_ID }),
	]);
	expect(requests[0].mediaSourceId).toBeUndefined();
	await page.reload();
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible();
	expect(requests).toHaveLength(2);
	expect(requests[1].mediaSourceId).toBeUndefined();
});
