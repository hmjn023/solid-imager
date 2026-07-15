import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
	const overflow = await page.evaluate(
		() =>
			document.documentElement.scrollWidth -
			document.documentElement.clientWidth,
	);
	expect(overflow).toBeLessThanOrEqual(1);
}

test("app navigation is responsive and accessible", async ({
	page,
}, testInfo) => {
	await page.goto("/about");
	await expect(page.locator("#main-content")).toBeVisible();
	await expectNoHorizontalOverflow(page);

	const usesMobileMenu = ["responsive-320", "responsive-375"].includes(
		testInfo.project.name,
	);
	if (!usesMobileMenu) {
		const aboutLink = page
			.getByRole("navigation", { name: "主要ナビゲーション" })
			.getByRole("link", { name: "About", exact: true });
		await expect(aboutLink).toHaveAttribute("aria-current", "page");
		await expect(aboutLink).toBeVisible();
		return;
	}

	const menuButton = page.getByRole("button", { name: "メニューを開く" });
	await menuButton.click();
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await expect(
		dialog.getByRole("link", { name: "About", exact: true }),
	).toHaveAttribute("aria-current", "page");

	await page.keyboard.press("Escape");
	await expect(dialog).toBeHidden();
	await expect(menuButton).toBeFocused();

	await menuButton.click();
	await dialog.getByRole("link", { name: "Search", exact: true }).click();
	await expect(page).toHaveURL(/\/search$/);
	await expect(dialog).toBeHidden();
	await expectNoHorizontalOverflow(page);
});
