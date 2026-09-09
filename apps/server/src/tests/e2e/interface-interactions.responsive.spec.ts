import type { Page } from "@playwright/test";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SIMILAR_FILE_NAME,
	E2E_SIMILAR_MEDIA_ID,
	E2E_SOURCE_ID,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

const searchPath = "/search";
const sourcePath = `/sources/${E2E_SOURCE_ID}`;
const mediaPath = (mediaId: string) => `${sourcePath}/${mediaId}`;

async function openSearch(page: Page): Promise<void> {
	await page.goto(searchPath);
	await waitForAppHydration(page);
	await expect(page.locator("[data-media-id]").first()).toBeVisible();
}

test("Workspace command palette opens from the keyboard and restores focus", async ({
	page,
}) => {
	await openSearch(page);

	const origin = page.getByRole("button", {
		name: "Quick actions",
		exact: true,
	});
	await expect(origin).toBeVisible();
	await origin.focus();
	await expect(origin).toBeFocused();

	await page.keyboard.press("ControlOrMeta+KeyK");
	const palette = page.getByRole("dialog", { name: "Quick actions" });
	await expect(palette).toBeVisible();
	await expect(palette.getByPlaceholder("Search actions…")).toBeFocused();

	await page.keyboard.press("Escape");
	await expect(palette).toBeHidden();
	await expect(origin).toBeFocused();
});

test("Workspace slash shortcut focuses search without swallowing slash input", async ({
	page,
}) => {
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
});

test("Workspace source search keeps URL paste in the input context", async ({
	page,
}) => {
	await page.goto(sourcePath);
	await waitForAppHydration(page);

	const searchInput = page.getByRole("combobox", {
		name: "メディアを検索",
		exact: true,
	});
	await searchInput.focus();
	const pastedUrl = "https://fixture.invalid/reference.png";
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
		origin: new URL(page.url()).origin,
	});
	await page.evaluate((url) => navigator.clipboard.writeText(url), pastedUrl);
	await searchInput.press("ControlOrMeta+KeyV");

	await expect(searchInput).toBeFocused();
	await expect(searchInput).toHaveValue(pastedUrl);
	await expect(
		page.getByRole("dialog", { name: "メディアをアップロード" }),
	).toHaveCount(0);
});

test("Workspace source collection supports additive and range selection gestures", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "responsive-desktop",
		"Modifier-key collection selection is exercised with a desktop keyboard.",
	);
	await page.setViewportSize({ width: 1600, height: 900 });
	await page.goto(sourcePath);
	await waitForAppHydration(page);

	const mediaItems = page.locator("[data-media-id]");
	await expect(mediaItems.nth(4)).toBeVisible();
	const bulkActions = page.getByTestId("bulk-actions-bar");

	await mediaItems.nth(0).click({ modifiers: ["Control"] });
	await expect(bulkActions).toContainText("1 件選択中");
	await mediaItems.nth(2).click({ modifiers: ["Control"] });
	await expect(bulkActions).toContainText("2 件選択中");
	await mediaItems.nth(4).click({ modifiers: ["Shift"] });
	await expect(bulkActions).toContainText("3 件選択中");
});

test("Workspace global search keeps collection selection independent from preview", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "responsive-desktop",
		"Modifier-key collection selection is exercised with a desktop keyboard.",
	);
	await page.setViewportSize({ width: 1600, height: 900 });
	await openSearch(page);

	const mediaItems = page.locator("[data-media-id]");
	await expect(mediaItems.nth(1)).toBeVisible();
	const bulkActions = page.getByTestId("search-bulk-actions-bar");

	await mediaItems.nth(0).click({ modifiers: ["Control"] });
	await expect(bulkActions).toContainText("1 件選択中");
	await mediaItems.nth(1).click({ modifiers: ["Shift"] });
	await expect(bulkActions).toContainText("2 件選択中");
});

test("Workspace global search exposes media and bulk actions", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "responsive-desktop",
		"Context-menu and modifier selection actions are exercised on desktop.",
	);
	await page.setViewportSize({ width: 1600, height: 900 });
	await openSearch(page);

	const mediaItem = page.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`);
	await mediaItem.click({ button: "right" });
	await expect(
		page.getByRole("menuitem", { name: "削除", exact: true }),
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
	await expect(moveDialog).toContainText("Move Media");
	await moveDialog.getByRole("button", { name: "Cancel", exact: true }).click();

	await mediaItem.click({ button: "right" });
	await page.getByRole("menuitem", { name: "削除", exact: true }).click();
	const deleteDialog = page.getByRole("dialog");
	await expect(deleteDialog).toContainText(E2E_PRIMARY_FILE_NAME);
	await deleteDialog
		.getByRole("button", { name: "キャンセル", exact: true })
		.click();

	const bulkActions = page.getByTestId("search-bulk-actions-bar");
	await mediaItem.click({ modifiers: ["Control"] });
	await expect(bulkActions).toContainText("1 件選択中");
	const bulkActionButton = bulkActions.getByRole("button", {
		name: "一括操作を実行",
		exact: true,
	});
	await expect(bulkActionButton).toBeEnabled();
	await bulkActionButton.click();
	const bulkDialog = page.getByRole("dialog");
	await expect(bulkDialog).toContainText("一括削除");
	await bulkDialog
		.getByRole("button", { name: "キャンセル", exact: true })
		.click();
});

test("Workspace fine-pointer collection separates selection from opening detail", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "responsive-desktop",
		"The selection-preview contract is specific to a desktop fine pointer.",
	);
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
});

test("Workspace detail exposes zoom controls and non-destructive action choices", async ({
	page,
}) => {
	await page.goto(mediaPath(E2E_PRIMARY_MEDIA_ID));
	await waitForAppHydration(page);
	await expect(
		page.getByRole("img", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
	).toBeVisible();

	const zoomControls = page.getByRole("toolbar", {
		name: "Image zoom controls",
	});
	const resetZoom = zoomControls.getByRole("button", {
		name: "Reset zoom to fit",
	});
	await expect(zoomControls).toBeVisible();
	await expect(resetZoom).toContainText("100%");
	await zoomControls.getByRole("button", { name: "Zoom in" }).click();
	await expect(resetZoom).toContainText("125%");
	await resetZoom.click();
	await expect(resetZoom).toContainText("100%");

	const moreActions = page.getByRole("button", {
		name: "More actions",
		exact: true,
	});
	await moreActions.scrollIntoViewIfNeeded();
	await moreActions.click();
	await expect(
		page.getByRole("button", { name: "Download original", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Delete media…", exact: true }),
	).toBeVisible();
});

test("Workspace settings exposes device-local shortcut configuration", async ({
	page,
}) => {
	await page.goto("/config");
	await waitForAppHydration(page);

	await expect(page.locator("form")).toHaveCount(1);
	await expect(
		page.getByRole("group", { name: "Job Processing", exact: true }),
	).toBeVisible();

	await page.getByRole("tab", { name: /^Shortcuts\b/ }).click();
	await expect(
		page.getByRole("heading", { name: "Keyboard shortcuts", exact: true }),
	).toBeVisible();
	await expect(
		page.getByLabel("Command palette", { exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Reset all", exact: true }),
	).toBeVisible();
});
