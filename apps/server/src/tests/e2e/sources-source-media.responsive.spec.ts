import type { Locator, Page } from "@playwright/test";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SOURCE_ID,
	E2E_SOURCE_NAME,
	getFixtureMediaPath,
	sourcePath,
} from "./support/fixture";
import {
	expect,
	expectRouteHealthy,
	test,
	waitForAppHydration,
} from "./support/test";

function usesMobileControls(projectName: string): boolean {
	return ["responsive-320", "responsive-375"].includes(projectName);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
	const overflow = await page.evaluate(
		() =>
			document.documentElement.scrollWidth -
			document.documentElement.clientWidth,
	);
	expect(overflow).toBeLessThanOrEqual(1);
}

async function expectTouchTarget(locator: Locator): Promise<void> {
	const box = await locator.boundingBox();
	expect(box).not.toBeNull();
	expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
	expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
}

async function expectInsideViewport(
	page: Page,
	locator: Locator,
): Promise<void> {
	const box = await locator.boundingBox();
	const viewport = page.viewportSize();
	expect(box).not.toBeNull();
	expect(viewport).not.toBeNull();
	if (!(box && viewport)) {
		return;
	}
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.y).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
	expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
}

test("library entry points redirect to canonical search", {
	tag: "@desktop-only",
}, async ({ page }) => {
	for (const path of ["/", "/sources", "/v2", "/v2/search"]) {
		await page.goto(path);
		await expect(page).toHaveURL(/\/search(?:\?.*)?$/);
		await waitForAppHydration(page);
		await expect(
			page.getByText("すべてのメディア", { exact: true }).last(),
		).toBeVisible();
		await expectRouteHealthy(page);
	}
});

test("versioned detail routes preserve query and hash during redirect", {
	tag: "@desktop-only",
}, async ({ page }) => {
	await page.goto(
		`/v2/sources/${E2E_SOURCE_ID}/${E2E_PRIMARY_MEDIA_ID}?migration=1#details`,
	);
	await expect(page).toHaveURL(
		new RegExp(
			`/sources/${E2E_SOURCE_ID}/${E2E_PRIMARY_MEDIA_ID}\\?migration=1#details$`,
		),
	);
	await waitForAppHydration(page);
	await expect(
		page.getByRole("img", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
	).toBeVisible();
	await expectRouteHealthy(page);
});

test("source media exposes mobile filters and touch selection", async ({
	page,
}, testInfo) => {
	await page.goto(sourcePath());
	await expect(
		page
			.locator("#main-content")
			.getByText(E2E_SOURCE_NAME, { exact: true })
			.first(),
	).toBeVisible();
	const resultCount = page.getByText(/^[\d,]+ items$/);
	await expect(resultCount).toHaveCount(1);
	await expect(resultCount).toBeVisible();
	const firstMedia = page.locator("[data-media-id]").first();
	await expect(firstMedia).toBeVisible();
	await waitForAppHydration(page);
	await expect(page.getByTestId("media-load-more-sentinel")).toBeVisible();
	await expectNoHorizontalOverflow(page);

	const addMediaButton = page.getByRole("button", {
		name: "追加",
		exact: true,
	});
	if (usesMobileControls(testInfo.project.name))
		await expectTouchTarget(addMediaButton);
	await expectInsideViewport(page, addMediaButton);
	const fileChooser = page.waitForEvent("filechooser");
	await addMediaButton.click();
	await (await fileChooser).setFiles(
		getFixtureMediaPath(E2E_PRIMARY_FILE_NAME),
	);
	const uploadDialog = page.getByRole("dialog");
	await expect(
		uploadDialog.getByRole("heading", {
			name: "メディアをアップロード",
			exact: true,
		}),
	).toBeVisible();
	const filenameInput = uploadDialog.getByLabel("ファイル名", { exact: true });
	await expect(filenameInput).toHaveValue(E2E_PRIMARY_FILE_NAME);
	await filenameInput.fill("temporary-name.png");
	await uploadDialog
		.getByRole("button", { name: "キャンセル", exact: true })
		.click();
	const discardDialog = page.getByRole("alertdialog");
	await expect(discardDialog).toContainText("アップロード内容を破棄しますか？");
	await discardDialog
		.getByRole("button")
		.filter({ hasText: "編集を続ける" })
		.click();
	await expect(discardDialog).toBeHidden();
	await expect(filenameInput).toHaveValue("temporary-name.png");
	await uploadDialog
		.getByRole("button", { name: "キャンセル", exact: true })
		.click();
	await discardDialog
		.getByRole("button")
		.filter({ hasText: "破棄して閉じる" })
		.click();
	await expect(discardDialog).toBeHidden();
	await expect(uploadDialog).toBeHidden();
	const reopenedFileChooser = page.waitForEvent("filechooser");
	await addMediaButton.click();
	await (await reopenedFileChooser).setFiles(
		getFixtureMediaPath(E2E_PRIMARY_FILE_NAME),
	);
	await expect(filenameInput).toHaveValue(E2E_PRIMARY_FILE_NAME);
	await page.keyboard.press("Escape");
	await discardDialog
		.getByRole("button")
		.filter({ hasText: "破棄して閉じる" })
		.click();
	await expect(discardDialog).toBeHidden();
	await expect(uploadDialog).toBeHidden();

	const selectModeButton = page.getByRole("button", {
		name: "複数選択",
		exact: true,
	});
	if (usesMobileControls(testInfo.project.name))
		await expectTouchTarget(selectModeButton);
	await selectModeButton.click();
	const bulkToolbar = page.getByTestId("bulk-actions-bar");
	await expect(bulkToolbar).toContainText("0 件選択中");
	await expect(
		bulkToolbar.getByRole("button", { name: "一括操作を実行", exact: true }),
	).toBeDisabled();
	await page.getByRole("button", { name: "解除", exact: true }).click();
	await expect(bulkToolbar).toBeHidden();
	await expect(addMediaButton).toBeVisible();

	await selectModeButton.click();
	const selectableMedia = page.locator("button[data-media-id]").first();
	await expect(selectableMedia).toBeVisible();
	await selectableMedia.click();
	await expect(bulkToolbar).toContainText("1 件選択中");
	await expect(addMediaButton).toBeVisible();
	await expectInsideViewport(page, bulkToolbar);
	await page.getByRole("button", { name: "解除", exact: true }).click();
	await expect(addMediaButton).toBeVisible();

	const filterButton = page.getByRole("button", { name: /^検索フィルター、/ });
	if (usesMobileControls(testInfo.project.name))
		await expectTouchTarget(filterButton);
	await filterButton.click();
	const filterDialog = page.getByRole("dialog", {
		name: "検索フィルター",
		exact: true,
	});
	const fileNameInput = filterDialog.getByRole("textbox", {
		name: "ファイル名検索",
		exact: true,
	});
	await fileNameInput.fill(E2E_PRIMARY_FILE_NAME);
	await filterDialog.getByRole("button", { name: "適用", exact: true }).click();
	await expect(filterDialog).toBeHidden();
	await expect(resultCount).toHaveText("1 items");
	await expect(
		page.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`),
	).toBeVisible();

	await expectNoHorizontalOverflow(page);
});

test("canonical media grid opens its context menu", {
	tag: "@desktop-only",
}, async ({ page }) => {
	await page.goto(sourcePath());
	await waitForAppHydration(page);

	const firstMedia = page.locator("[data-media-id]").first();
	await expect(firstMedia).toBeVisible();
	await firstMedia.click({ button: "right" });

	await expectRouteHealthy(page);
	await expect(page.getByRole("menu")).toBeVisible();
	await expect(
		page.getByRole("menuitem", { name: "類似度検索", exact: true }),
	).toBeVisible();
});
