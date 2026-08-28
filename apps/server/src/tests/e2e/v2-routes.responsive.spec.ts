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

test("V2 sidebar keeps navigation items separated in a short viewport", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1440, height: 480 });
	await page.goto("/v2/search");
	await waitForAppHydration(page);

	const sidebar = page.getByRole("complementary", {
		name: "アプリケーションサイドバー",
	});
	await expect(sidebar).toBeVisible();

	const verticalGaps = await sidebar.evaluate((element) => {
		const links = Array.from(element.querySelectorAll("a"))
			.map((link) => link.getBoundingClientRect())
			.filter((rect) => rect.height > 0)
			.sort((first, second) => first.top - second.top);
		return links.slice(1).map((rect, index) => rect.top - links[index].bottom);
	});

	expect(Math.min(...verticalGaps)).toBeGreaterThanOrEqual(0);
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

test("V2 restore exposes and selects the TAR format", async ({ page }) => {
	await page.goto("/v2/manager");
	await waitForAppHydration(page);

	const categoryNavigation = page.locator(
		'nav[aria-label="Manager categories"]:visible',
	);
	const transferButton = categoryNavigation
		.getByRole("button", { name: /Data transfer/ })
		.first();
	await transferButton.scrollIntoViewIfNeeded();
	await transferButton.click();
	await expect(
		page.getByRole("heading", { name: "Data transfer", exact: true }),
	).toBeVisible();

	const selectTriggers = page.locator('button[aria-haspopup="listbox"]');
	await selectTriggers.nth(0).click();
	await page
		.getByRole("option", { name: E2E_SOURCE_NAME, exact: true })
		.click();

	await selectTriggers.nth(2).click();
	const tarOption = page.getByRole("option", {
		name: "TAR archive",
		exact: true,
	});
	await expect(tarOption).toBeVisible();
	await tarOption.click();
	await expect(selectTriggers.nth(2)).toContainText("TAR archive");
	await expect(page.locator('input[type="file"]')).toHaveAttribute(
		"accept",
		".tar,.zip,application/x-tar,application/zip",
	);
});

test("V2 completed export starts a native streaming download", async ({
	page,
}) => {
	await page.goto("/v2/manager");
	await waitForAppHydration(page);

	const categoryNavigation = page.locator(
		'nav[aria-label="Manager categories"]:visible',
	);
	await categoryNavigation
		.getByRole("button", { name: /Data transfer/ })
		.first()
		.click();

	const selectTriggers = page.locator('button[aria-haspopup="listbox"]');
	await selectTriggers.nth(0).click();
	await page
		.getByRole("option", { name: E2E_SOURCE_NAME, exact: true })
		.click();
	await selectTriggers.nth(1).click();
	await page.getByRole("option", { name: "TAR archive", exact: true }).click();
	await page.getByRole("button", { name: "Queue export", exact: true }).click();
	await expect(page.getByText(/Export queued/)).toBeVisible();

	await page.goto("/v2/jobs");
	await waitForAppHydration(page);
	const exportJob = page.getByRole("button", { name: /Source Export/ }).first();
	await expect(exportJob).toBeVisible({ timeout: 30_000 });
	await exportJob.click();
	const inspector = page.getByRole("complementary", { name: "Job details" });
	await expect(inspector).toContainText("Completed", { timeout: 30_000 });

	const download = page.waitForEvent("download");
	await inspector.getByRole("button", { name: /Download source-/ }).click();
	expect((await download).suggestedFilename()).toMatch(/\.tar$/);
});

test("V2 search filter opens without remounting media results", async ({
	page,
}) => {
	await page.goto("/v2/search");
	await waitForAppHydration(page);

	const firstMedia = page.locator("[data-media-id]").first();
	await expect(firstMedia).toBeVisible();
	await page.evaluate(() => {
		const state = window as Window & {
			__v2FirstMedia?: Element;
			__v2FilterDialog?: Element;
			__v2SawLoadingFallback?: boolean;
			__v2LoadingObserver?: MutationObserver;
		};
		state.__v2FirstMedia =
			document.querySelector("[data-media-id]") ?? undefined;
		state.__v2SawLoadingFallback = false;
		state.__v2LoadingObserver = new MutationObserver(() => {
			if (
				document.body.textContent?.includes("画面を読み込んでいます") ||
				document.body.textContent?.includes("検索結果を読み込んでいます")
			) {
				state.__v2SawLoadingFallback = true;
			}
		});
		state.__v2LoadingObserver.observe(document.body, {
			childList: true,
			subtree: true,
		});
	});

	const filterButton = page.getByRole("button", {
		name: /検索フィルター、\d+件の条件/,
	});
	await filterButton.click();
	const filterDialog = page.getByRole("dialog", { name: "検索フィルター" });
	await expect(filterDialog).toBeVisible();
	await filterDialog.evaluate((element) => {
		(
			window as Window & {
				__v2FilterDialog?: Element;
			}
		).__v2FilterDialog = element;
	});

	const comboboxNames = await filterDialog
		.getByRole("combobox")
		.evaluateAll((elements) =>
			elements.map((element) => {
				const labelledBy = element.getAttribute("aria-labelledby");
				return (
					element.getAttribute("aria-label") ??
					(labelledBy
						? document.getElementById(labelledBy)?.textContent?.trim()
						: "")
				);
			}),
		);
	expect(comboboxNames.length).toBeGreaterThan(0);
	expect(comboboxNames.every(Boolean)).toBe(true);

	await filterDialog.getByRole("button", { name: "閉じる" }).click();
	await filterButton.click();
	await expect(filterDialog).toBeVisible();
	const renderState = await page.evaluate(() => {
		const state = window as Window & {
			__v2FirstMedia?: Element;
			__v2FilterDialog?: Element;
			__v2SawLoadingFallback?: boolean;
			__v2LoadingObserver?: MutationObserver;
		};
		state.__v2LoadingObserver?.disconnect();
		return {
			filterNodeWasPreserved:
				state.__v2FilterDialog ===
				document.querySelector('[role="dialog"][aria-label="検索フィルター"]'),
			mediaNodeWasPreserved:
				state.__v2FirstMedia === document.querySelector("[data-media-id]"),
			sawLoadingFallback: state.__v2SawLoadingFallback,
		};
	});
	expect(renderState.filterNodeWasPreserved).toBe(true);
	expect(renderState.mediaNodeWasPreserved).toBe(true);
	expect(renderState.sawLoadingFallback).toBe(false);
});
