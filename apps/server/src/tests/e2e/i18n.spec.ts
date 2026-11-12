import { expect, test, waitForAppHydration } from "./support/test";
import { mediaPath } from "./support/fixture";

test("display language changes the whole workspace and survives direct navigation and reload", async ({
	page,
}, testInfo) => {
	await page.goto("/config");
	await waitForAppHydration(page);
	await expect(page.locator("html")).toHaveAttribute("lang", "ja");
	await expect(
		page.getByRole("link", { name: "ライブラリ", exact: true }),
	).toBeVisible();
	await page.getByRole("tab", { name: /画面表示/ }).click();
	await page.getByLabel("表示言語", { exact: true }).click();
	await page.getByRole("option", { name: "English", exact: true }).click();
	await waitForAppHydration(page);
	await expect(page.locator("html")).toHaveAttribute("lang", "en");
	await expect(
		page.getByRole("link", { name: "Settings", exact: true }),
	).toBeVisible();
	await page.getByRole("tab", { name: /Interface/ }).click();
	await expect(page.getByLabel("Display language", { exact: true })).toHaveText(
		"English",
	);
	await expect(page.getByRole("tab", { name: /Interface/ })).toHaveAttribute(
		"aria-selected",
		"true",
	);
	await page.setViewportSize({ width: 375, height: 812 });
	await expect(page.getByRole("tab", { name: /Interface/ })).toHaveAttribute(
		"aria-selected",
		"true",
	);
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					document.documentElement.scrollWidth -
					document.documentElement.clientWidth,
			),
		)
		.toBeLessThanOrEqual(1);
	await page.screenshot({
		path: testInfo.outputPath("english-language-settings.png"),
	});
	await page.goto(mediaPath());
	await waitForAppHydration(page);
	await expect(
		page.getByRole("button", { name: "More actions", exact: true }),
	).toBeVisible();
	await page.reload();
	await waitForAppHydration(page);
	await expect(
		page.getByRole("button", { name: "More actions", exact: true }),
	).toBeVisible();
	await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("English preferences render correctly on the first visit without hydration warnings", async ({
	page,
}) => {
	await page.addInitScript(() => {
		if (!localStorage.getItem("solid-imager.locale"))
			localStorage.setItem("solid-imager.locale", "en");
	});
	await page.goto("/search");
	await waitForAppHydration(page);
	await expect(
		page.getByRole("link", { name: "Library", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("combobox", { name: "Search media", exact: true }),
	).toBeVisible();
	await expect(page.locator("html")).toHaveAttribute("lang", "en");
	await page.goto("/config");
	await waitForAppHydration(page);
	await page.getByRole("tab", { name: /Interface/ }).click();
	await page.getByLabel("Display language", { exact: true }).click();
	await page.getByRole("option", { name: "日本語", exact: true }).click();
	await waitForAppHydration(page);
	await expect(
		page.getByRole("link", { name: "設定", exact: true }),
	).toBeVisible();
	await expect(page.locator("html")).toHaveAttribute("lang", "ja");
});
