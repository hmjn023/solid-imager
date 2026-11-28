import type { Page } from "@playwright/test";
import { waitForAppHydration } from "./test";

export async function selectManagerCategory(page: Page, label: string) {
	await waitForAppHydration(page);
	const navigation = page.getByRole("navigation", { name: "管理カテゴリ" });
	const select = navigation.getByRole("combobox", { name: /^管理カテゴリ/ });
	const category = navigation.getByRole("button", {
		name: new RegExp(`^${label}(?: |$)`),
	});
	const trigger = select.or(category).filter({ visible: true });
	const opensListbox =
		(await trigger.getAttribute("aria-haspopup")) === "listbox";
	await trigger.click();
	if (opensListbox) {
		await page.getByRole("option", { name: label, exact: true }).click();
	}
}
