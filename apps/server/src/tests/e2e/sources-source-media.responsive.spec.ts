import type { Locator, Page } from "@playwright/test";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_SOURCE_ID,
	E2E_SOURCE_NAME,
	getFixtureMediaPath,
	sourcePath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

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

test("sources actions stay operable without horizontal overflow", async ({
	page,
}) => {
	await page.goto("/sources");
	await expect(
		page.getByRole("heading", { name: "Media Sources", exact: true }),
	).toBeVisible();
	const sourceCard = page
		.getByTestId("source-card")
		.filter({ hasText: E2E_SOURCE_NAME });
	await expect(sourceCard).toBeVisible();
	await waitForAppHydration(page);
	await expectNoHorizontalOverflow(page);

	const addSourceButton = page.getByRole("button", {
		name: "Add Source",
		exact: true,
	});
	const syncAllButton = page.getByRole("button", {
		name: "Sync All",
		exact: true,
	});
	await expectTouchTarget(addSourceButton);
	await expectTouchTarget(syncAllButton);
	await expectTouchTarget(sourceCard.getByTestId("sync-source-btn"));
	await expectTouchTarget(sourceCard.getByTestId("edit-source-btn"));
	await expectTouchTarget(sourceCard.getByTestId("delete-source-btn"));

	await addSourceButton.click();
	const addSourceDialog = page.getByRole("dialog");
	await expect(addSourceDialog).toBeVisible();
	await addSourceDialog.getByLabel("Name", { exact: true }).fill("temporary");
	await addSourceDialog
		.getByLabel("Directory Path", { exact: true })
		.fill("/tmp/temporary");
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await expect(addSourceButton).toBeFocused();

	await addSourceButton.click();
	await expect(addSourceDialog.getByLabel("Name", { exact: true })).toHaveValue(
		"",
	);
	await expect(
		addSourceDialog.getByLabel("Directory Path", { exact: true }),
	).toHaveValue("");
	await addSourceDialog
		.getByRole("button", { name: "Add Source", exact: true })
		.click();
	await expect(addSourceDialog.getByText("Name is required")).toBeVisible();
	await expect(addSourceDialog.getByText("Path is required")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(addSourceDialog).toBeHidden();

	await sourceCard.getByTestId("edit-source-btn").click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog")).toHaveCount(0);

	await sourceCard.getByTestId("delete-source-btn").click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await expectNoHorizontalOverflow(page);
});

test("source media exposes mobile filters and touch selection", async ({
	page,
}, testInfo) => {
	await page.goto(sourcePath());
	await expect(
		page.getByRole("heading", {
			name: `Media in Source: ${E2E_SOURCE_ID}`,
			exact: true,
		}),
	).toBeVisible();
	await expect(page.locator("[data-media-id]").first()).toBeVisible();
	await waitForAppHydration(page);
	await expect(page.getByTestId("media-load-more-sentinel")).toBeVisible();
	await expectNoHorizontalOverflow(page);

	const addMediaButton = page.getByRole("button", { name: "Add media" });
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
	await expect(uploadDialog).toBeHidden();
	const reopenedFileChooser = page.waitForEvent("filechooser");
	await addMediaButton.click();
	await (await reopenedFileChooser).setFiles(
		getFixtureMediaPath(E2E_PRIMARY_FILE_NAME),
	);
	await expect(filenameInput).toHaveValue(E2E_PRIMARY_FILE_NAME);
	await page.keyboard.press("Escape");
	await expect(uploadDialog).toBeHidden();

	const selectModeButton = page.getByRole("button", {
		name: "複数選択",
		exact: true,
	});
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
	await expect(addMediaButton).toBeHidden();
	await expectInsideViewport(page, bulkToolbar);
	await page.getByRole("button", { name: "解除", exact: true }).click();
	await expect(addMediaButton).toBeVisible();

	if (usesMobileControls(testInfo.project.name)) {
		const sourceActionsButton = page.getByRole("button", {
			name: "ソース操作を開く",
		});
		const filterResultsButton = page.getByRole("button", {
			name: "Filter results",
		});
		await expectTouchTarget(sourceActionsButton);
		await expectTouchTarget(filterResultsButton);
		await sourceActionsButton.click();
		const sourceActionsDialog = page.getByRole("dialog");
		await expect(
			sourceActionsDialog.getByRole("button", {
				name: "NDJSON メタデータを書き出す",
			}),
		).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(sourceActionsDialog).toBeHidden();
		await sourceActionsButton.click();
		const restoreFileChooser = page.waitForEvent("filechooser");
		await sourceActionsDialog
			.getByRole("button", { name: "ダンプを復元する", exact: true })
			.click();
		await restoreFileChooser;
		await expect(sourceActionsDialog).toBeHidden();

		await filterResultsButton.click();
		const filterDialog = page.getByRole("dialog");
		await expect(filterDialog).toBeVisible();
		await expect(filterDialog.getByRole("status")).toContainText("現在の条件");
		const fileNameInput = filterDialog.getByPlaceholder("ファイル名を入力...");
		await fileNameInput.fill("e2e");
		await expect(filterDialog.getByRole("status")).toContainText(
			"ファイル名: e2e",
		);
		await filterDialog
			.getByRole("button", { name: "適用", exact: true })
			.click();
		await expect(filterDialog).toBeHidden();
	} else {
		await expect(
			page.getByRole("heading", { name: "検索フィルター", exact: true }),
		).toBeVisible();
	}

	await expectNoHorizontalOverflow(page);
});
