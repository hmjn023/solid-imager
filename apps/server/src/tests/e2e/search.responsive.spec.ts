import type { Page } from "@playwright/test";
import { E2E_PRIMARY_FILE_NAME } from "./support/fixture";
import { expect, test } from "./support/test";

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
	const overflow = await page.evaluate(
		() =>
			document.documentElement.scrollWidth -
			document.documentElement.clientWidth,
	);
	expect(overflow).toBeLessThanOrEqual(1);
}

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
	await fileNameInput.fill(E2E_PRIMARY_FILE_NAME);
	await filterDialog.getByRole("button", { name: "適用", exact: true }).click();
	await expect(filterDialog).toBeHidden();
	await expect(page.getByText("1 items", { exact: true })).toBeVisible();
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
	const apply = filterDialog.getByRole("button", { name: "適用", exact: true });
	await expect(apply).toBeInViewport();
	await expectNoHorizontalOverflow(page);
	await apply.click();
	await expect(filterDialog).toBeHidden();
	await expect
		.poll(async () =>
			Number(
				(await page.getByText(/^[\d,]+ items$/).textContent())?.replace(
					/[^\d]/g,
					"",
				),
			),
		)
		.toBeGreaterThan(1);
	await expect(primaryResult).toBeVisible();
	await expectNoHorizontalOverflow(page);
});
