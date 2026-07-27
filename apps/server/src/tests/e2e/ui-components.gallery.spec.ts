import { expect, test } from "@playwright/test";

function getGalleryUrl(): string {
	const port = process.env.E2E_GALLERY_PORT;
	if (!port) {
		throw new Error("E2E_GALLERY_PORT must be set by the E2E runner");
	}
	return `http://127.0.0.1:${port}`;
}

test("shared Solid UI components preserve keyboard and overlay behavior", async ({
	page,
}) => {
	await page.goto(getGalleryUrl());
	await expect(
		page.getByRole("heading", { name: "Solid UI component gallery" }),
	).toBeVisible();

	const nameInput = page.getByLabel("Name", { exact: true });
	await nameInput.focus();
	await expect(nameInput).toBeFocused();

	await page.getByRole("tab", { name: "Second" }).click();
	await expect(page.getByText("Second panel", { exact: true })).toBeVisible();

	const dialogTrigger = page.getByRole("button", { name: "Open dialog" });
	await dialogTrigger.click();
	await expect(page.getByRole("dialog")).toContainText("Example dialog");
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await expect(dialogTrigger).toBeFocused();

	await page.getByRole("button", { name: "Show toast" }).click();
	await expect(page.getByText("Saved", { exact: true })).toBeVisible();

	await page
		.getByText("Right-click target", { exact: true })
		.click({ button: "right" });
	await expect(
		page.getByRole("menuitem", { name: "Context action" }),
	).toBeVisible();
});

test("shared Solid UI gallery has no narrow viewport overflow", async ({
	page,
}) => {
	await page.setViewportSize({ width: 320, height: 720 });
	await page.goto(getGalleryUrl());
	const overflow = await page.evaluate(
		() =>
			document.documentElement.scrollWidth -
			document.documentElement.clientWidth,
	);
	expect(overflow).toBeLessThanOrEqual(1);
	await expect(page).toHaveScreenshot("solid-ui-gallery-320.png", {
		animations: "disabled",
		fullPage: true,
	});
});
