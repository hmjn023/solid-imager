import { expect, test } from "./support/test";

test("pro search dialog keeps the value input focused while typing", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "responsive-desktop",
		"The pro-search editor is shown in the desktop filter panel.",
	);

	await page.goto("/search");
	await page.getByRole("button", { name: "詳細", exact: true }).click();
	await page.getByRole("button", { name: "詳細条件を編集" }).click();

	const dialog = page.getByRole("dialog");
	await dialog.getByRole("button", { name: "+ 条件" }).click();

	const valueInput = dialog.getByPlaceholder("値...");
	await valueInput.pressSequentially("focus");
	await expect(valueInput).toHaveValue("focus");
	await expect(valueInput).toBeFocused();
});
