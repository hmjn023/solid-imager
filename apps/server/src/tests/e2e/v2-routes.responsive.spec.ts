import type { Page } from "@playwright/test";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SIMILAR_FILE_NAME,
	E2E_SIMILAR_MEDIA_ID,
	E2E_SOURCE_ID,
	E2E_SOURCE_NAME,
} from "./support/fixture";
import {
	expect,
	expectRouteHealthy,
	test,
	waitForAppHydration,
} from "./support/test";

const v2SourcePath = `/v2/sources/${E2E_SOURCE_ID}`;
const v2MediaPath = (mediaId: string) => `${v2SourcePath}/${mediaId}`;

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
	const overflow = await page.evaluate(
		() =>
			document.documentElement.scrollWidth -
			document.documentElement.clientWidth,
	);
	expect(overflow).toBeLessThanOrEqual(1);
}

test("V2 routes survive direct navigation and reload", async ({ page }) => {
	const routes = [
		["/v2/search", "すべてのメディア"],
		[v2SourcePath, E2E_SOURCE_NAME],
		[v2MediaPath(E2E_PRIMARY_MEDIA_ID), E2E_PRIMARY_FILE_NAME],
		["/v2/manager", "Manager"],
		["/v2/jobs", "Jobs"],
		["/v2/config", "Settings"],
		["/v2/about", "About Solid Imager"],
	] as const;

	for (const [path, visibleText] of routes) {
		await page.goto(path);
		await waitForAppHydration(page);
		await expect(
			page.getByText(visibleText, { exact: true }).last(),
		).toBeVisible();
		await page.reload();
		await waitForAppHydration(page);
		await expect(
			page.getByText(visibleText, { exact: true }).last(),
		).toBeVisible();
		await expectRouteHealthy(page);
		await expectNoHorizontalOverflow(page);
	}
});

test("V2 detail changes after returning to a collection", async ({ page }) => {
	await page.goto(v2SourcePath);
	await waitForAppHydration(page);

	await page.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`).click();
	await expect(page).toHaveURL(v2MediaPath(E2E_PRIMARY_MEDIA_ID));
	await expect(
		page.getByRole("img", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
	).toBeVisible();

	await page.getByRole("button", { name: "一覧に戻る", exact: true }).click();
	await expect(page).toHaveURL(v2SourcePath);
	await page.locator(`[data-media-id="${E2E_SIMILAR_MEDIA_ID}"]`).click();
	await expect(page).toHaveURL(v2MediaPath(E2E_SIMILAR_MEDIA_ID));
	await expect(
		page.getByRole("img", { name: E2E_SIMILAR_FILE_NAME, exact: true }),
	).toBeVisible();
});

test("V2 wide collection uses selection preview before detail navigation", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1600, height: 900 });
	await page.goto(v2SourcePath);
	await waitForAppHydration(page);

	await page.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`).click();
	await expect(page).toHaveURL(v2SourcePath);
	const inspector = page.getByRole("complementary", {
		name: "選択中のメディア",
	});
	await expect(inspector).toContainText(E2E_PRIMARY_FILE_NAME);
	await page.locator(`[data-media-id="${E2E_SIMILAR_MEDIA_ID}"]`).click();
	await expect(page).toHaveURL(v2SourcePath);
	await expect(inspector).toContainText(E2E_SIMILAR_FILE_NAME);
	await expect(
		inspector.getByRole("img", { name: E2E_SIMILAR_FILE_NAME, exact: true }),
	).toBeVisible();
	await inspector.getByRole("button", { name: "詳細を開く" }).click();
	await expect(page).toHaveURL(v2MediaPath(E2E_SIMILAR_MEDIA_ID));
});
