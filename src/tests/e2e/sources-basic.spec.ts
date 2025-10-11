import { expect, test } from "@playwright/test";

test.describe("Media Sources - Basic Functionality", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/sources");
		await page.waitForLoadState("networkidle");
	});

	test("should display the sources page with header and add button", async ({
		page,
	}) => {
		// ページタイトルを確認します。
		await expect(page.locator('h1:has-text("Media Sources")')).toBeVisible();

		// ソース追加ボタンの存在を確認します。
		await expect(page.locator('button:has-text("Add Source")')).toBeVisible();

		// ソースグリッドの存在を確認します。
		await expect(page.locator(".grid")).toBeVisible();
	});

	test("should open and close add modal", async ({ page }) => {
		// モーダルを開きます。
		await page.click('button:has-text("Add Source")');
		await expect(
			page.locator(
				'[data-testid="source-form-modal"], h2:has-text("Add Media Source")',
			),
		).toBeVisible();

		// モーダルを閉じます。
		await page.click('button:has-text("Cancel")');
		await expect(
			page.locator(
				'[data-testid="source-form-modal"], h2:has-text("Add Media Source")',
			),
		).not.toBeVisible();
	});

	test("should show validation - create button disabled with empty form", async ({
		page,
	}) => {
		await page.click('button:has-text("Add Source")');

		// 作成ボタンは初期状態で無効であるべきです。
		await expect(page.locator('button:has-text("Create")')).toBeDisabled();
	});

	test("should enable create button when required fields are filled", async ({
		page,
	}) => {
		await page.click('button:has-text("Add Source")');

		// 必須フィールドを入力します。
		await page.fill("#source-name", "Test Source");
		await page.fill("#source-path", "/test/path");

		// 作成ボタンは有効であるべきです。
		await expect(page.locator('button:has-text("Create")')).toBeEnabled();
	});
});
