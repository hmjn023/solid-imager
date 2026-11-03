import {
	E2E_PRIMARY_MEDIA_ID,
	E2E_SOURCE_ID,
	mediaPath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";
import { mediaActivitySchema } from "@solid-imager/core/domain/media/schemas";

test("a detail visit counts once and media preferences persist after reload", async ({
	page,
}) => {
	const location = { sourceId: E2E_SOURCE_ID, mediaId: E2E_PRIMARY_MEDIA_ID };
	const details = await page.request.post("/api/rpc/media/getDetails", {
		data: { json: location },
	});
	expect(details.ok()).toBe(true);
	const original = mediaActivitySchema.parse(
		(await details.json()).json.activity,
	);
	const rating = original.rating === 4 ? 5 : 4;
	const visitResponses = () =>
		page.waitForResponse(
			(response) =>
				response.url().endsWith("/api/rpc/media/recordView") && response.ok(),
		);
	let visits = 0;
	page.on("request", (request) => {
		if (request.url().endsWith("/api/rpc/media/recordView")) visits++;
	});
	try {
		const first = visitResponses();
		await page.goto(mediaPath());
		await first;
		await waitForAppHydration(page);
		const favorite = page.getByRole("button", { name: /Favorite/ });
		await favorite.click();
		await expect(favorite).toHaveAttribute(
			"aria-pressed",
			String(!original.favorite),
		);
		const picker = page.getByRole("button", { name: /^Rating/ });
		await picker.click();
		await page.getByRole("option", { name: `${rating} stars` }).click();
		await expect(picker).toContainText(`${rating} stars`);
		expect(visits).toBe(1);
		const second = visitResponses();
		await page.reload();
		const activity = mediaActivitySchema.parse(
			(await (await second).json()).json,
		);
		await expect(
			page.getByText(`Views: ${activity.viewCount}`, { exact: true }),
		).toBeVisible();
		await expect(favorite).toHaveAttribute(
			"aria-pressed",
			String(!original.favorite),
		);
		await expect(picker).toContainText(`${rating} stars`);
		expect(activity.lastViewedAt).toBeInstanceOf(Date);
		expect(visits).toBe(2);
	} finally {
		const restored = await page.request.post(
			"/api/rpc/media/updatePreferences",
			{
				data: {
					json: {
						...location,
						data: { rating: original.rating, favorite: original.favorite },
					},
				},
			},
		);
		expect(restored.ok()).toBe(true);
	}
});
