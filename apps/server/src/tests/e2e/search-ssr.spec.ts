import {
	captureSearchSnapshotResponseSchema,
	defaultState,
} from "@solid-imager/core/search";
import { apiRequest } from "./support/api";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SIMILAR_MEDIA_ID,
	sourcePath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

const searchEndpoint = "/api/media/search";
const snapshotEndpoint = "/api/search-snapshots";

for (const [name, path] of [
	["library", "/search"],
	["source", sourcePath()],
] as const) {
	test(`${name} renders default and saved results in the document and reuses them after hydration`, async ({
		baseURL,
		browser,
		browserHealth,
		page,
	}) => {
		const response = await apiRequest(page.request, "searchSnapshots/capture", {
			state: { ...defaultState, searchQuery: E2E_PRIMARY_FILE_NAME },
		});
		await expect(response).toBeOK();
		const { id } = captureSearchSnapshotResponseSchema.parse(
			await response.json(),
		);
		const savedPath = `${path}?search=${id}`;
		const primary = `#main-content [data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`;
		const other = `#main-content [data-media-id="${E2E_SIMILAR_MEDIA_ID}"]`;

		const noScripts = await browser.newContext({
			baseURL,
			javaScriptEnabled: false,
		});
		try {
			const document = await noScripts.newPage();
			await document.goto(path);
			await expect(document.locator(primary)).toBeVisible();
			await expect(document.locator(other)).toBeVisible();
			await document.goto(savedPath);
			await expect(document.locator(primary)).toBeVisible();
			await expect(document.locator(other)).toHaveCount(0);
			await expect(
				document.getByRole("button", {
					name: `name:${E2E_PRIMARY_FILE_NAME}を解除`,
				}),
			).toBeVisible();
		} finally {
			await noScripts.close();
		}

		const defaultCheckpoint = browserHealth.requestCheckpoint();
		await page.goto(path);
		await waitForAppHydration(page);
		await expect(page.locator(primary)).toBeVisible();
		await expect(page).toHaveURL(/\?search=[0-9a-f-]{36}$/);
		expect(
			browserHealth.apiRequestCountPathSince(defaultCheckpoint, searchEndpoint),
		).toBe(0);

		for (const navigate of [() => page.goto(savedPath), () => page.reload()]) {
			const checkpoint = browserHealth.requestCheckpoint();
			await navigate();
			await waitForAppHydration(page);
			await page.waitForFunction(
				(snapshotId) => history.state?.searchSnapshot?.id === snapshotId,
				id,
			);
			await expect(page.locator(primary)).toBeVisible();
			await expect(page.locator(other)).toHaveCount(0);
			expect(
				browserHealth.apiRequestCountPathSince(checkpoint, searchEndpoint),
			).toBe(0);
			expect(
				browserHealth.apiRequestCountPathSince(
					checkpoint,
					`${snapshotEndpoint}/${id}`,
				),
			).toBe(0);
		}
	});
}
