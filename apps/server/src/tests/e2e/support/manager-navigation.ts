import type { Page } from "@playwright/test";

export async function selectManagerCategory(page: Page, label: string) {
	const navigation = page.getByRole("navigation", { name: "管理カテゴリ" });
	const select = navigation.getByRole("button", { name: /^管理カテゴリ/ });
	const category = navigation.getByRole("button", {
		name: new RegExp(`^${label}(?: |$)`),
	});
	await select.or(category).waitFor({ state: "visible" });
	if (await select.isVisible()) {
		await select.click();
		await page.getByRole("option", { name: label, exact: true }).click();
	} else {
		await category.click();
	}
}
