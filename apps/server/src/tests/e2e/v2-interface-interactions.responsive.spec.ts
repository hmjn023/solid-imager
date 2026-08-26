import type { Page } from "@playwright/test";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SIMILAR_FILE_NAME,
	E2E_SIMILAR_MEDIA_ID,
	E2E_SOURCE_ID,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

const v2SearchPath = "/v2/search";
const v2SourcePath = `/v2/sources/${E2E_SOURCE_ID}`;
const v2MediaPath = (mediaId: string) => `${v2SourcePath}/${mediaId}`;

async function openV2Search(page: Page): Promise<void> {
	await page.goto(v2SearchPath);
	await waitForAppHydration(page);
	await expect(page.locator("[data-media-id]").first()).toBeVisible();
}

test("V2 command palette opens from the keyboard and restores focus", async ({
	page,
}) => {
	await openV2Search(page);

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

test("V2 slash shortcut focuses search without swallowing slash input", async ({
	page,
}) => {
	await openV2Search(page);

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

test("V2 source search keeps URL paste in the input context", async ({
	page,
}) => {
	await page.goto(v2SourcePath);
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

test("V2 source collection supports additive and range selection gestures", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "responsive-desktop",
		"Modifier-key collection selection is exercised with a desktop keyboard.",
	);
	await page.setViewportSize({ width: 1600, height: 900 });
	await page.goto(v2SourcePath);
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

test("V2 global search keeps collection selection independent from preview", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "responsive-desktop",
		"Modifier-key collection selection is exercised with a desktop keyboard.",
	);
	await page.setViewportSize({ width: 1600, height: 900 });
	await openV2Search(page);

	const mediaItems = page.locator("[data-media-id]");
	await expect(mediaItems.nth(1)).toBeVisible();
	const bulkActions = page.getByTestId("search-bulk-actions-bar");

	await mediaItems.nth(0).click({ modifiers: ["Control"] });
	await expect(bulkActions).toContainText("1 件選択中");
	await mediaItems.nth(1).click({ modifiers: ["Shift"] });
	await expect(bulkActions).toContainText("2 件選択中");
});

test("V2 fine-pointer collection separates selection from opening detail", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "responsive-desktop",
		"The selection-preview contract is specific to a desktop fine pointer.",
	);
	await page.setViewportSize({ width: 1600, height: 900 });
	await openV2Search(page);

	const similarMedia = page.locator(
		`[data-media-id="${E2E_SIMILAR_MEDIA_ID}"]`,
	);
	await similarMedia.click();
	await expect(page).toHaveURL(/\/v2\/search(?:\?.*)?$/);
	await expect(similarMedia).toHaveAttribute("aria-current", "true");
	await expect(similarMedia).toHaveAttribute("aria-pressed", "false");
	const inspector = page.getByRole("complementary", {
		name: "選択中のメディア",
	});
	await expect(inspector).toContainText(E2E_SIMILAR_FILE_NAME);

	await similarMedia.dblclick();
	await expect(page).toHaveURL(v2MediaPath(E2E_SIMILAR_MEDIA_ID));
	await expect(
		page.locator(`[data-media-viewer] img[alt="${E2E_SIMILAR_FILE_NAME}"]`),
	).toBeVisible();

	await page.goBack();
	await expect(page).toHaveURL(/\/v2\/search(?:\?.*)?$/);
	const primaryMedia = page.locator(
		`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`,
	);
	await expect(primaryMedia).toBeVisible();
	await primaryMedia.focus();
	await page.keyboard.press("Enter");
	await expect(page).toHaveURL(v2MediaPath(E2E_PRIMARY_MEDIA_ID));
});

test("V2 detail exposes zoom controls and non-destructive action choices", async ({
	page,
}) => {
	await page.goto(v2MediaPath(E2E_PRIMARY_MEDIA_ID));
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

test("V2 settings exposes device-local shortcut configuration", async ({
	page,
}) => {
	await page.goto("/v2/config");
	await waitForAppHydration(page);

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
