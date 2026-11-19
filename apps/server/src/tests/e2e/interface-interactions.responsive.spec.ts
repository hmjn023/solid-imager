import type { Page } from "@playwright/test";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SIMILAR_FILE_NAME,
	E2E_SIMILAR_MEDIA_ID,
	E2E_SOURCE_ID,
} from "./support/fixture";
import { selectSettingsCategory } from "./support/settings-navigation";
import { expect, test, waitForAppHydration } from "./support/test";

const searchPath = "/search";
const sourcePath = `/sources/${E2E_SOURCE_ID}`;
const mediaPath = (mediaId: string) => `${sourcePath}/${mediaId}`;

async function openSearch(page: Page): Promise<void> {
	await page.goto(searchPath);
	await waitForAppHydration(page);
	await expect(page.locator("[data-media-id]").first()).toBeVisible();
}

test(
	"Workspace command palette opens from the keyboard and restores focus",
	{
		tag: "@desktop-only",
	},
	async ({ page }) => {
		await openSearch(page);

		const origin = page.getByRole("button", {
			name: "クイック操作",
			exact: true,
		});
		await expect(origin).toBeVisible();
		await origin.focus();
		await expect(origin).toBeFocused();

		await page.keyboard.press("ControlOrMeta+KeyK");
		const palette = page.getByRole("dialog", { name: "クイック操作" });
		await expect(palette).toBeVisible();
		await expect(palette.getByPlaceholder("操作を検索...")).toBeFocused();

		const items = palette.locator("[cmdk-item]");
		await expect(items.first()).toHaveAttribute("aria-selected", "true");
		await page.keyboard.press("ArrowUp");
		await expect(items.last()).toHaveAttribute("aria-selected", "true");
		await page.keyboard.press("ArrowDown");
		await expect(items.first()).toHaveAttribute("aria-selected", "true");

		await page.keyboard.press("Escape");
		await expect(palette).toBeHidden();
		await expect(origin).toBeFocused();
	},
);

test(
	"Workspace slash shortcut focuses search without swallowing slash input",
	{
		tag: "@desktop-only",
	},
	async ({ page }) => {
		await openSearch(page);

		const searchInput = page.getByRole("combobox", {
			name: "メディアを検索",
			exact: true,
		});
		const filterButton = page.getByRole("button", {
			name: /検索フィルター、\d+件の条件/,
		});
		await filterButton.focus();
		await expect(filterButton).toBeFocused();

		await page.keyboard.press("/");
		await expect(searchInput).toBeFocused();

		await page.keyboard.type("e2e");
		await page.keyboard.press("/");
		await expect(searchInput).toHaveValue("e2e/");
	},
);

test(
	"Workspace source search keeps URL paste in the input context",
	{
		tag: "@desktop-only",
	},
	async ({ page }) => {
		await page.goto(sourcePath);
		await waitForAppHydration(page);

		const searchInput = page.getByRole("combobox", {
			name: "メディアを検索",
			exact: true,
		});
		await searchInput.focus();
		const pastedUrl = "https://fixture.invalid/reference.png";
		await page
			.context()
			.grantPermissions(["clipboard-read", "clipboard-write"], {
				origin: new URL(page.url()).origin,
			});
		await page.evaluate((url) => navigator.clipboard.writeText(url), pastedUrl);
		await searchInput.press("ControlOrMeta+KeyV");

		await expect(searchInput).toBeFocused();
		await expect(searchInput).toHaveValue(pastedUrl);
		await expect(
			page.getByRole("dialog", { name: "メディアをアップロード" }),
		).toHaveCount(0);
	},
);

test(
	"Workspace source collection supports additive and range selection gestures",
	{
		tag: "@desktop-only",
	},
	async ({ page }) => {
		await page.setViewportSize({ width: 1600, height: 900 });
		await page.goto(sourcePath);
		await waitForAppHydration(page);

		const mediaItems = page.locator("[data-media-id]");
		await expect(mediaItems.nth(4)).toBeVisible();
		const bulkActions = page.getByTestId("bulk-actions-bar");

		await mediaItems.nth(0).click({ modifiers: ["Control"] });
		await expect(bulkActions).toContainText("1件選択中");
		await mediaItems.nth(2).click({ modifiers: ["Control"] });
		await expect(bulkActions).toContainText("2件選択中");
		await mediaItems.nth(4).click({ modifiers: ["Shift"] });
		await expect(bulkActions).toContainText("3件選択中");
	},
);

for (const collection of [
	{ name: "Library", path: searchPath, bulkBar: "search-bulk-actions-bar" },
	{ name: "Source", path: sourcePath, bulkBar: "bulk-actions-bar" },
]) {
	test(`${collection.name} opens media and selects it the same way in grid and list`, async ({
		browserHealth,
		page,
	}) => {
		// Back immediately after opening detail can cancel its initial requests.
		browserHealth.allowRequestFailure(
			"/api/rpc/media/getDetails",
			"net::ERR_ABORTED",
		);
		browserHealth.allowRequestFailure(
			"/api/rpc/media/getRelated",
			"net::ERR_ABORTED",
		);
		browserHealth.allowRequestFailure(
			"/api/rpc/jobs/events",
			"net::ERR_ABORTED",
		);
		const item = page.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`);
		const currentFile = item
			.getByText(E2E_PRIMARY_FILE_NAME, { exact: true })
			.first();
		const grid = page.getByRole("button", {
			name: "グリッド表示",
			exact: true,
		});
		const list = page.getByRole("button", { name: "リスト表示", exact: true });
		const bulkBar = page.getByTestId(collection.bulkBar);

		await page.goto(collection.path);
		await waitForAppHydration(page);
		await expect(item).toBeVisible();
		await item.click();
		await expect(page).toHaveURL(mediaPath(E2E_PRIMARY_MEDIA_ID));
		await expect(
			page.getByRole("heading", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
		).toBeVisible();

		await page.goBack();
		await list.click();
		await currentFile.click();
		await expect(page).toHaveURL(mediaPath(E2E_PRIMARY_MEDIA_ID));
		await expect(
			page.getByRole("heading", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
		).toBeVisible();

		await page.goBack();
		await page.getByRole("button", { name: "複数選択", exact: true }).click();
		await currentFile.click();
		await expect(item).toHaveAttribute("aria-selected", "true");
		await expect(bulkBar).toContainText("1件選択中");
		await grid.click();
		await expect(item).toHaveAttribute("aria-pressed", "true");
		await item.click();
		await expect(bulkBar).toContainText("0件選択中");
	});
}

test(
	"Workspace global search keeps collection selection independent from preview",
	{
		tag: "@desktop-only",
	},
	async ({ page }) => {
		await page.setViewportSize({ width: 1600, height: 900 });
		await openSearch(page);

		const mediaItems = page.locator("[data-media-id]");
		await expect(mediaItems.nth(1)).toBeVisible();
		const bulkActions = page.getByTestId("search-bulk-actions-bar");

		await mediaItems.nth(0).click({ modifiers: ["Control"] });
		await expect(bulkActions).toContainText("1件選択中");
		await mediaItems.nth(1).click({ modifiers: ["Shift"] });
		await expect(bulkActions).toContainText("2件選択中");
	},
);

test(
	"Workspace global search exposes media and bulk actions",
	{
		tag: "@desktop-only",
	},
	async ({ page }) => {
		await page.setViewportSize({ width: 1600, height: 900 });
		await openSearch(page);

		const mediaItem = page.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`);
		await mediaItem.click({ button: "right" });
		await expect(
			page.getByRole("menuitem", { name: /^削除(?: Delete)?$/, exact: true }),
		).toBeVisible();
		await expect(
			page.getByRole("menuitem", { name: "他のソースへコピー", exact: true }),
		).toBeVisible();
		await expect(
			page.getByRole("menuitem", { name: "他のソースへ移動", exact: true }),
		).toBeVisible();

		await page
			.getByRole("menuitem", { name: "他のソースへ移動", exact: true })
			.click();
		const moveDialog = page.getByRole("dialog");
		await expect(moveDialog).toContainText("メディアを移動");
		await moveDialog
			.getByRole("button", { name: "キャンセル", exact: true })
			.click();

		await mediaItem.click({ button: "right" });
		await page
			.getByRole("menuitem", { name: /^削除(?: Delete)?$/, exact: true })
			.click();
		const deleteDialog = page.getByRole("alertdialog");
		await expect(deleteDialog).toContainText(E2E_PRIMARY_FILE_NAME);
		await deleteDialog
			.getByRole("button", { name: "キャンセル", exact: true })
			.click();

		const bulkActions = page.getByTestId("search-bulk-actions-bar");
		await mediaItem.click({ modifiers: ["Control"] });
		await expect(bulkActions).toContainText("1件選択中");
		const bulkActionButton = bulkActions.getByRole("button", {
			name: "一括操作を実行",
			exact: true,
		});
		await expect(bulkActionButton).toBeEnabled();
		await bulkActionButton.click();
		const bulkDialog = page.getByRole("dialog");
		await expect(bulkDialog).toContainText("コピー (別ソースへ)");
		await bulkDialog
			.getByRole("button", { name: "キャンセル", exact: true })
			.click();
	},
);

test(
	"Workspace fine-pointer collection separates selection from opening detail",
	{
		tag: "@desktop-only",
	},
	async ({ page }) => {
		await page.setViewportSize({ width: 1600, height: 900 });
		await openSearch(page);

		const similarMedia = page.locator(
			`[data-media-id="${E2E_SIMILAR_MEDIA_ID}"]`,
		);
		await similarMedia.click();
		await expect(page).toHaveURL(/\/search(?:\?.*)?$/);
		await expect(similarMedia).toHaveAttribute("aria-current", "true");
		await expect(similarMedia).toHaveAttribute("aria-pressed", "false");
		const inspector = page.getByRole("complementary", {
			name: "選択中のメディア",
		});
		await expect(inspector).toContainText(E2E_SIMILAR_FILE_NAME);

		await similarMedia.dblclick();
		await expect(page).toHaveURL(mediaPath(E2E_SIMILAR_MEDIA_ID));
		await expect(
			page.locator(`[data-media-viewer] img[alt="${E2E_SIMILAR_FILE_NAME}"]`),
		).toBeVisible();

		await page.goBack();
		await expect(page).toHaveURL(/\/search(?:\?.*)?$/);
		const primaryMedia = page.locator(
			`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`,
		);
		await expect(primaryMedia).toBeVisible();
		await primaryMedia.focus();
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL(mediaPath(E2E_PRIMARY_MEDIA_ID));
	},
);

test("Workspace detail exposes zoom controls and non-destructive action choices", async ({
	page,
}) => {
	await page.goto(mediaPath(E2E_PRIMARY_MEDIA_ID));
	await waitForAppHydration(page);
	await expect(
		page.getByRole("img", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
	).toBeVisible();

	await page
		.getByRole("button", {
			name: `${E2E_PRIMARY_FILE_NAME}の画像ビューアーを開く`,
			exact: true,
		})
		.click();
	const zoomControls = page.getByRole("toolbar", {
		name: "画像のズーム操作",
	});
	const resetZoom = zoomControls.getByRole("button", {
		name: "画面に合わせる",
	});
	await expect(zoomControls).toBeVisible();
	await expect(resetZoom).toContainText("100%");
	await zoomControls.getByRole("button", { name: "拡大" }).click();
	await expect(resetZoom).toContainText("125%");
	await resetZoom.click();
	await expect(resetZoom).toContainText("100%");

	await page.keyboard.press("Escape");
	const moreActions = page.getByRole("button", {
		name: "その他の操作",
		exact: true,
	});
	await moreActions.scrollIntoViewIfNeeded();
	await moreActions.click();
	await expect(
		page.getByRole("menuitem", { name: "原本をダウンロード", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("menuitem", { name: "メディアを削除...", exact: true }),
	).toBeVisible();
});

test("Workspace detail closes More actions before opening a modal", async ({
	page,
}) => {
	await page.goto(mediaPath(E2E_PRIMARY_MEDIA_ID));
	await waitForAppHydration(page);

	await page.getByRole("button", { name: "その他の操作", exact: true }).click();
	await page
		.getByRole("menuitem", { name: "メディアを削除...", exact: true })
		.click();
	await expect(
		page.getByRole("menuitem", { name: "原本をダウンロード", exact: true }),
	).toBeHidden();
	const deleteDialog = page.getByRole("alertdialog");
	await expect(deleteDialog).toBeVisible();
	await expect(
		deleteDialog.getByRole("heading", { name: "このメディアを削除しますか？" }),
	).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(
				() => document.activeElement?.closest('[role="alertdialog"]') !== null,
			),
		)
		.toBe(true);
	await page.keyboard.press("Escape");
	await expect(deleteDialog).toBeHidden();
});

test("Workspace settings exposes device-local shortcut configuration", async ({
	page,
}) => {
	await page.goto("/config");
	await waitForAppHydration(page);

	await expect(page.locator("form")).toHaveCount(1);
	await expect(
		page.getByRole("group", { name: "ジョブ処理", exact: true }),
	).toBeVisible();

	await selectSettingsCategory(page, "ショートカット");
	await expect(
		page.getByRole("heading", {
			name: "キーボードショートカット",
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByLabel("コマンドパレット", { exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "すべてリセット", exact: true }),
	).toBeVisible();
});
