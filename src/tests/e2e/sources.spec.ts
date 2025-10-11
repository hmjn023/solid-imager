import { expect, test } from "@playwright/test";

test.describe("Media Sources Management", () => {
	test.beforeEach(async ({ page }) => {
		// 各テストの前にソースページに移動します。
		await page.goto("/sources");
		await page.waitForLoadState("networkidle");
	});

	test.describe("Source Creation", () => {
		test("should open add source modal when clicking Add Source button", async ({
			page,
		}) => {
			// Click the Add Source button
			await page.click('button:has-text("Add Source")');

			// モーダルが開いたことを確認します。
			await expect(
				page.locator('h2:has-text("Add Media Source")'),
			).toBeVisible();

			// フォームフィールドが存在することを確認します。
			await expect(
				page.locator('input[placeholder="Enter source name"]'),
			).toBeVisible();
			await expect(
				page.locator('input[placeholder="Enter description (optional)"]'),
			).toBeVisible();
			await expect(page.locator("select")).toBeVisible();
			await expect(
				page.locator('input[placeholder="Enter file path"]'),
			).toBeVisible();
		});

		test("should create a new local source successfully", async ({ page }) => {
			// モーダルを開きます。
			await page.click('button:has-text("Add Source")');

			// フォームを入力します。
			await page.fill(
				'input[placeholder="Enter source name"]',
				"Test Local Source",
			);
			await page.fill(
				'input[placeholder="Enter description (optional)"]',
				"Test description",
			);
			await page.selectOption("select", "local");
			await page.fill('input[placeholder="Enter file path"]', "/test/path");

			// フォームを送信します。
			await page.click('button:has-text("Create")');

			// モーダルが閉じるのを待ちます。
			await expect(
				page.locator('h2:has-text("Add Media Source")'),
			).not.toBeVisible();

			// ソースがリストに表示されることを確認します（モックデータまたはAPIレスポンスを想定）。
			// これは実際のAPIの動作に基づいて調整が必要な場合があります。
			await expect(page.locator("text=Test Local Source")).toBeVisible();
		});

		test("should create a new SFTP source successfully", async ({ page }) => {
			await page.click('button:has-text("Add Source")');

			await page.fill(
				'input[placeholder="Enter source name"]',
				"Test SFTP Source",
			);
			await page.fill(
				'input[placeholder="Enter description (optional)"]',
				"SFTP test description",
			);
			await page.selectOption("select", "sftp");
			await page.fill(
				'input[placeholder="Enter file path"]',
				"/sftp/test/path",
			);

			await page.click('button:has-text("Create")');

			await expect(
				page.locator('h2:has-text("Add Media Source")'),
			).not.toBeVisible();
			await expect(page.locator("text=Test SFTP Source")).toBeVisible();
		});

		test("should create a new S3 source successfully", async ({ page }) => {
			await page.click('button:has-text("Add Source")');

			await page.fill(
				'input[placeholder="Enter source name"]',
				"Test S3 Source",
			);
			await page.fill(
				'input[placeholder="Enter description (optional)"]',
				"S3 test description",
			);
			await page.selectOption("select", "s3");
			await page.fill(
				'input[placeholder="Enter file path"]',
				"s3://test-bucket/path",
			);

			await page.click('button:has-text("Create")');

			await expect(
				page.locator('h2:has-text("Add Media Source")'),
			).not.toBeVisible();
			await expect(page.locator("text=Test S3 Source")).toBeVisible();
		});

		test("should close modal when clicking Cancel", async ({ page }) => {
			await page.click('button:has-text("Add Source")');

			// キャンセルをクリックします。
			await page.click('button:has-text("Cancel")');

			// モーダルが閉じていることを確認します。
			await expect(
				page.locator('h2:has-text("Add Media Source")'),
			).not.toBeVisible();
		});
	});

	test.describe("Form Validation", () => {
		test("should disable Create button when required fields are empty", async ({
			page,
		}) => {
			await page.click('button:has-text("Add Source")');

			// 作成ボタンは初期状態で無効であるべきです（空のフォーム）。
			await expect(page.locator('button:has-text("Create")')).toBeDisabled();

			// 名前のみを入力します。
			await page.fill('input[placeholder="Enter source name"]', "Test");
			await expect(page.locator('button:has-text("Create")')).toBeDisabled();

			// パスのみを入力します。
			await page.fill('input[placeholder="Enter source name"]', "");
			await page.fill('input[placeholder="Enter file path"]', "/test");
			await expect(page.locator('button:has-text("Create")')).toBeDisabled();

			// 両方の必須フィールドを入力します。
			await page.fill('input[placeholder="Enter source name"]', "Test");
			await expect(page.locator('button:has-text("Create")')).toBeEnabled();
		});

		test("should work with only required fields (name and path)", async ({
			page,
		}) => {
			await page.click('button:has-text("Add Source")');

			// Fill only required fields
			await page.fill(
				'input[placeholder="Enter source name"]',
				"Minimal Source",
			);
			await page.fill('input[placeholder="Enter file path"]', "/minimal/path");

			// 送信は成功するはずです。
			await page.click('button:has-text("Create")');
			await expect(
				page.locator('h2:has-text("Add Media Source")'),
			).not.toBeVisible();
		});
	});

	test.describe("Source Editing", () => {
		test("should open edit modal with pre-filled data when clicking Edit", async ({
			page,
		}) => {
			// ソースがロードされるのを待ち、最初のソースの編集をクリックします。
			await page
				.waitForSelector('[data-testid="source-card"]', { timeout: 5000 })
				.catch(() => {
					// テストIDがない場合、編集ボタンを探すことにフォールバックします。
				});

			// 最初の編集ボタンをクリックします。
			await page.click('button:has-text("Edit")').first();

			// 編集モーダルが開いたことを確認します。
			await expect(
				page.locator('h2:has-text("Edit Media Source")'),
			).toBeVisible();

			// ボタンが「Create」ではなく「Update」を表示していることを確認します。
			await expect(page.locator('button:has-text("Update")')).toBeVisible();

			// フォームフィールドが事前入力されていることを確認します（これはモックデータに依存します）。
			const nameInput = page.locator('input[placeholder="Enter source name"]');
			await expect(nameInput).not.toHaveValue("");
		});

		test("should update source successfully", async ({ page }) => {
			await page.click('button:has-text("Edit")').first();

			// 名前を変更します。
			await page.fill(
				'input[placeholder="Enter source name"]',
				"Updated Source Name",
			);
			await page.fill(
				'input[placeholder="Enter description (optional)"]',
				"Updated description",
			);

			// 更新を送信します。
			await page.click('button:has-text("Update")');

			// モーダルが閉じることを確認します。
			await expect(
				page.locator('h2:has-text("Edit Media Source")'),
			).not.toBeVisible();

			// 更新された名前が表示されることを確認します（APIモックが必要な場合があります）。
			await expect(page.locator("text=Updated Source Name")).toBeVisible();
		});

		test("should close edit modal when clicking Cancel", async ({ page }) => {
			await page.click('button:has-text("Edit")').first();

			// モーダルが開いていることを確認します。
			await expect(
				page.locator('h2:has-text("Edit Media Source")'),
			).toBeVisible();

			// キャンセルをクリックします。
			await page.click('button:has-text("Cancel")');

			// モーダルが閉じていることを確認します。
			await expect(
				page.locator('h2:has-text("Edit Media Source")'),
			).not.toBeVisible();
		});
	});

	test.describe("Source Deletion", () => {
		test("should open delete confirmation modal when clicking Delete", async ({
			page,
		}) => {
			// 最初の削除ボタンをクリックします。
			await page.click('button:has-text("Delete")').first();

			// 削除確認モーダルが開いたことを確認します。
			await expect(
				page.locator('h2:has-text("Delete Media Source")'),
			).toBeVisible();

			// 確認メッセージが表示されていることを確認します。
			await expect(
				page.locator("text=Are you sure you want to delete"),
			).toBeVisible();

			// 削除ボタンとキャンセルボタンが存在することを確認します。
			await expect(page.locator('button:has-text("Delete")')).toBeVisible();
			await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
		});

		test("should delete source when confirming", async ({ page }) => {
			// 削除前のソース名を取得します（検証のため）。
			const firstSourceName = await page
				.locator('[data-testid="source-card"] h3, .font-bold')
				.first()
				.textContent();

			await page.click('button:has-text("Delete")').first();

			// 削除を確認します。
			await page.click('button:has-text("Delete")').last(); // Use last to get the confirmation button

			// Verify modal closes
			await expect(
				page.locator('h2:has-text("Delete Media Source")'),
			).not.toBeVisible();

			// Verify source is removed (this might need API mocking)
			if (firstSourceName) {
				await expect(page.locator(`text=${firstSourceName}`)).not.toBeVisible();
			}
		});

		test("should cancel deletion when clicking Cancel", async ({ page }) => {
			const initialSourceCount = await page
				.locator('[data-testid="source-card"], .grid > div')
				.count();

			await page.click('button:has-text("Delete")').first();

			// Cancel deletion
			await page.click('button:has-text("Cancel")').last();

			// Verify modal closes
			await expect(
				page.locator('h2:has-text("Delete Media Source")'),
			).not.toBeVisible();

			// Verify source count remains the same
			await expect(
				page.locator('[data-testid="source-card"], .grid > div'),
			).toHaveCount(initialSourceCount);
		});
	});

	test.describe("Loading States", () => {
		test("should show loading state when submitting form", async ({ page }) => {
			await page.click('button:has-text("Add Source")');

			await page.fill('input[placeholder="Enter source name"]', "Loading Test");
			await page.fill('input[placeholder="Enter file path"]', "/loading/test");

			// Mock slow API response to see loading state
			await page.route("**/api/sources", async (route) => {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({
						id: "test",
						name: "Loading Test",
						type: "local",
					}),
				});
			});

			// Click submit and immediately check for loading state
			await page.click('button:has-text("Create")');

			// Verify loading state
			await expect(page.locator('button:has-text("Saving...")')).toBeVisible();

			// Wait for completion
			await expect(
				page.locator('h2:has-text("Add Media Source")'),
			).not.toBeVisible();
		});

		test("should show loading state when deleting", async ({ page }) => {
			await page.click('button:has-text("Delete")').first();

			// Mock slow delete API response
			await page.route("**/api/sources/*", async (route) => {
				if (route.request().method() === "DELETE") {
					await new Promise((resolve) => setTimeout(resolve, 1000));
					await route.fulfill({ status: 200 });
				} else {
					await route.continue();
				}
			});

			// Confirm deletion and check loading state
			await page.click('button:has-text("Delete")').last();

			// Verify loading state
			await expect(
				page.locator('button:has-text("Deleting...")'),
			).toBeVisible();
		});
	});

	test.describe("Error Handling", () => {
		test("should handle create API errors gracefully", async ({ page }) => {
			await page.click('button:has-text("Add Source")');

			await page.fill('input[placeholder="Enter source name"]', "Error Test");
			await page.fill('input[placeholder="Enter file path"]', "/error/test");

			// Mock API error
			await page.route("**/api/sources", async (route) => {
				if (route.request().method() === "POST") {
					await route.fulfill({
						status: 500,
						contentType: "application/json",
						body: JSON.stringify({ error: "Internal Server Error" }),
					});
				} else {
					await route.continue();
				}
			});

			await page.click('button:has-text("Create")');

			// Modal should remain open on error
			await expect(
				page.locator('h2:has-text("Add Media Source")'),
			).toBeVisible();

			// Button should return to normal state
			await expect(page.locator('button:has-text("Create")')).toBeVisible();
		});

		test("should handle delete API errors gracefully", async ({ page }) => {
			await page.click('button:has-text("Delete")').first();

			// Mock API error
			await page.route("**/api/sources/*", async (route) => {
				if (route.request().method() === "DELETE") {
					await route.fulfill({
						status: 500,
						contentType: "application/json",
						body: JSON.stringify({ error: "Failed to delete" }),
					});
				} else {
					await route.continue();
				}
			});

			await page.click('button:has-text("Delete")').last();

			// Modal should remain open on error
			await expect(
				page.locator('h2:has-text("Delete Media Source")'),
			).toBeVisible();

			// Button should return to normal state
			await expect(
				page.locator('button:has-text("Delete")').last(),
			).toBeVisible();
		});
	});
});
