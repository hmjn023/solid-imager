import type { Page } from "@playwright/test";

export function settingsCategorySelect(page: Page) {
	return page.getByRole("combobox", { name: /^設定カテゴリ(?: |$)/ });
}

export async function selectSettingsCategory(page: Page, label: string) {
	const select = settingsCategorySelect(page);
	const tab = page.getByRole("tab", { name: new RegExp(`^${label}(?: |$)`) });
	await select.or(tab).waitFor({ state: "visible" });
	if (await select.isVisible()) {
		await select.click();
		await page.getByRole("option", { name: label, exact: true }).click();
	} else {
		await tab.click();
	}
}
