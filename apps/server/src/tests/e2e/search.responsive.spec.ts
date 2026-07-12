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
	await expect(
		page.getByRole("heading", { name: "メディア検索", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible();
	await expectNoHorizontalOverflow(page);

	const usesMobileFilterDialog = ["responsive-320", "responsive-375"].includes(
		testInfo.project.name,
	);
	if (usesMobileFilterDialog) {
		await page.getByRole("button", { name: "Filter results" }).click();
		await expect(page.getByRole("dialog")).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "検索フィルター", exact: true }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "簡易", exact: true }),
		).toBeVisible();
	} else {
		await expect(
			page.getByRole("heading", { name: "検索フィルター", exact: true }),
		).toBeVisible();
		await expect(page.getByPlaceholder("ファイル名を入力...")).toBeVisible();
	}

	await expectNoHorizontalOverflow(page);
});
