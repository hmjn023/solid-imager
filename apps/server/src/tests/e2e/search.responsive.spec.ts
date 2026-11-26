import type { Page } from "@playwright/test";
import { apiPathPattern, apiRequest } from "./support/api";
import { expectDomPreserved } from "./support/dom";
import { E2E_PRIMARY_FILE_NAME, sourcePath } from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
	const overflow = await page.evaluate(
		() =>
			document.documentElement.scrollWidth -
			document.documentElement.clientWidth,
	);
	expect(overflow).toBeLessThanOrEqual(1);
}

test("loads a preset without optional settings in the source list", async ({
	page,
	request,
}, testInfo) => {
	const presetName = `E2E preset ${testInfo.project.name}`;
	const response = await apiRequest(request, "presets/create", {
		name: presetName,
		value: { type: "group", operator: "and", children: [] },
	});
	expect(response.ok(), await response.text()).toBe(true);
	const { id } = await response.json();

	try {
		await page.goto(sourcePath());
		await waitForAppHydration(page);
		await page.getByRole("button", { name: /^検索フィルター、/ }).click();
		const filters = page.getByRole("dialog", { name: "検索フィルター" });
		await filters.getByRole("button", { name: "プリセットを選択..." }).click();
		await expect(page.getByRole("option", { name: presetName })).toBeVisible();
	} finally {
		await apiRequest(request, "presets/delete", { id });
	}
});

test("keeps search filters available when presets fail to load", async ({
	page,
	browserHealth,
}) => {
	const presetsEndpoint = apiPathPattern("presets/list");
	const releaseFailure = Promise.withResolvers<void>();
	browserHealth.allowResponseFailure(presetsEndpoint);
	browserHealth.allowRequestFailure(presetsEndpoint, "net::ERR_ABORTED");
	browserHealth.allowConsole(
		"Failed to load resource: the server responded with a status of 503",
	);
	await page.route(
		presetsEndpoint,
		async (route) => {
			await releaseFailure.promise;
			await route.fulfill({
				status: 503,
				contentType: "text/plain",
				body: "Service Unavailable",
			});
		},
		{ times: 1 },
	);
	await page.goto("/search");
	await waitForAppHydration(page);
	await page.getByRole("button", { name: /^検索フィルター、/ }).click();
	const filters = page.getByRole("dialog", { name: "検索フィルター" });
	const status = filters.getByRole("status");
	try {
		await expect(status).toHaveText("");
		await expectDomPreserved({ status }, async () => {
			releaseFailure.resolve();
			await expect(status).toHaveText("プリセットを取得できませんでした");
			await expect(status).toBeVisible();
		});
	} finally {
		releaseFailure.resolve();
	}
	const filename = filters.getByRole("textbox", { name: "ファイル名検索" });
	await filename.fill(E2E_PRIMARY_FILE_NAME);

	await filters.getByRole("button", { name: "再試行" }).click();
	await expect(
		filters.getByRole("button", { name: "プリセットを選択..." }),
	).toBeVisible();
	await expect(status).toHaveText("");
	await expect(filename).toHaveValue(E2E_PRIMARY_FILE_NAME);
	await filters.getByRole("button", { name: "閉じる", exact: true }).click();
	await expect(filters).toBeHidden();
	await expect(page.getByText("1件", { exact: true })).toBeVisible();
});

test("search keeps controls usable without horizontal overflow", async ({
	page,
}, testInfo) => {
	await page.goto("/search");
	const primaryResult = page.getByRole("link", {
		name: new RegExp(E2E_PRIMARY_FILE_NAME),
	});
	await expect(primaryResult).toBeVisible();
	await expect(
		page.getByRole("combobox", { name: "メディアを検索", exact: true }),
	).toBeVisible();
	await expectNoHorizontalOverflow(page);
	await waitForAppHydration(page);

	if (testInfo.project.name === "responsive-768") {
		await page.setViewportSize({ width: 768, height: 480 });
	}
	const filterButton = page.getByRole("button", { name: /^検索フィルター、/ });
	await filterButton.click();
	const filterDialog = page.getByRole("dialog", {
		name: "検索フィルター",
		exact: true,
	});
	await expect(filterDialog).toBeVisible();
	const fileNameInput = filterDialog.getByRole("textbox", {
		name: "ファイル名検索",
		exact: true,
	});
	await expect(fileNameInput).toBeInViewport();
	const tagInput = filterDialog.getByRole("combobox", {
		name: "タグ (すべて含む)",
		exact: true,
	});
	if (testInfo.project.name === "responsive-768") {
		await tagInput.scrollIntoViewIfNeeded();
	}
	await expect(tagInput).toBeInViewport();
	if (testInfo.project.name === "responsive-390") {
		await expect(
			filterDialog.getByRole("combobox", { name: "IP", exact: true }),
		).toBeInViewport();
		await expect(
			filterDialog.getByRole("combobox", {
				name: "キャラクター",
				exact: true,
			}),
		).toBeInViewport();
		await expect(filterDialog).toHaveCSS("width", "366px");
	}
	await expect(
		filterDialog.getByRole("textbox", {
			name: "自然言語検索（EmbeddingGemma 2）",
		}),
	).toBeHidden();
	await expect(filterDialog.getByText("ソート", { exact: true })).toHaveCount(
		0,
	);
	await fileNameInput.fill(E2E_PRIMARY_FILE_NAME);
	const closeFilters = filterDialog.getByRole("button", {
		name: "閉じる",
		exact: true,
	});
	await closeFilters.click();
	await expect(filterDialog).toBeHidden();
	await expect(page.getByText("1件", { exact: true })).toBeVisible();
	await expect(primaryResult).toBeVisible();

	// Filters share state with the search bar. Closing preserves the applied condition.
	await filterButton.click();
	await expect(fileNameInput).toHaveValue(E2E_PRIMARY_FILE_NAME);
	await page.keyboard.press("Escape");
	await expect(filterDialog).toBeHidden();
	await expect(filterButton).toBeFocused();
	await filterButton.click();
	await expect(fileNameInput).toHaveValue(E2E_PRIMARY_FILE_NAME);
	await filterDialog
		.getByRole("button", { name: "すべて解除", exact: true })
		.click();
	await expect(fileNameInput).toHaveValue("");

	const lastFilter = filterDialog.getByRole("combobox", {
		name: "プロジェクト",
		exact: true,
	});
	await lastFilter.scrollIntoViewIfNeeded();
	await expect(lastFilter).toBeInViewport();
	await lastFilter.focus();
	await expect(lastFilter).toBeFocused();
	// Leave the combobox's suggestions before activating the footer.
	await lastFilter.press("Tab");
	await expect(closeFilters).toBeInViewport();
	await expectNoHorizontalOverflow(page);
	await closeFilters.click();
	await expect(filterDialog).toBeHidden();
	await expect
		.poll(async () =>
			Number(
				(await page.getByText(/^[\d,]+件$/).textContent())?.replace(
					/[^\d]/g,
					"",
				),
			),
		)
		.toBeGreaterThan(1);
	await expect(primaryResult).toBeVisible();
	await expectNoHorizontalOverflow(page);
});
