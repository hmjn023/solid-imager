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

async function expectTextContrast(
	page: Page,
	selector: string,
	backgroundSelector: string,
): Promise<void> {
	const contrast = await page.evaluate(
		({ selector, backgroundSelector }) => {
			const element = document.querySelector(selector);
			const background = document.querySelector(backgroundSelector);
			if (
				!(element instanceof HTMLElement) ||
				!(background instanceof HTMLElement)
			) {
				throw new Error("Navigation link or drawer was not found");
			}

			const parseRgb = (color: string): number[] =>
				color
					.match(/\d+(?:\.\d+)?/g)
					?.slice(0, 3)
					.map(Number) ?? [];
			const relativeLuminance = ([red, green, blue]: number[]): number => {
				const [linearRed, linearGreen, linearBlue] = [red, green, blue].map(
					(channel) => {
						const normalized = channel / 255;
						return normalized <= 0.04045
							? normalized / 12.92
							: ((normalized + 0.055) / 1.055) ** 2.4;
					},
				);
				return 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue;
			};

			const foreground = relativeLuminance(
				parseRgb(window.getComputedStyle(element).color),
			);
			const drawerBackground = relativeLuminance(
				parseRgb(window.getComputedStyle(background).backgroundColor),
			);
			return (
				(Math.max(foreground, drawerBackground) + 0.05) /
				(Math.min(foreground, drawerBackground) + 0.05)
			);
		},
		{ selector, backgroundSelector },
	);
	expect(contrast).toBeGreaterThanOrEqual(4.5);
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
	await expectTextContrast(
		page,
		'[role="dialog"] a[href="/search"]',
		'[role="dialog"]',
	);

	await page.keyboard.press("Escape");
	await expect(dialog).toBeHidden();
	await expect(menuButton).toBeFocused();

	await menuButton.click();
	await dialog.getByRole("link", { name: "Search", exact: true }).click();
	await expect(page).toHaveURL(/\/search$/);
	await expect(dialog).toBeHidden();
	await expectNoHorizontalOverflow(page);
});
