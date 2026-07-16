import type { Page } from "@playwright/test";
import { E2E_PRIMARY_FILE_NAME, mediaPath } from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

const mobileProjects = ["responsive-320", "responsive-375"];

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
	const overflow = await page.evaluate(
		() =>
			document.documentElement.scrollWidth -
			document.documentElement.clientWidth,
	);
	expect(overflow).toBeLessThanOrEqual(1);
}

test("media detail, manager, and settings remain usable on narrow screens", async ({
	page,
}, testInfo) => {
	await page.goto(mediaPath());
	await expect(
		page.getByRole("heading", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
	).toBeVisible();
	await waitForAppHydration(page);
	await expect(
		page.getByRole("img", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
	).toBeVisible();
	const detailsHeading = page.getByRole("heading", {
		name: "Details",
		exact: true,
	});
	await detailsHeading.scrollIntoViewIfNeeded();
	await expect(detailsHeading).toBeInViewport();
	await expectNoHorizontalOverflow(page);

	await page.goto("/manager");
	await expect(
		page.getByRole("heading", { name: "Entity Manager", exact: true }),
	).toBeVisible();
	await waitForAppHydration(page);
	await expectNoHorizontalOverflow(page);

	const projectName = `Responsive project ${testInfo.project.name}`;
	await page.getByRole("button", { name: "Create New", exact: true }).click();
	const projectDialog = page.getByRole("dialog");
	await expect(projectDialog).toBeVisible();
	await projectDialog.getByLabel("Name", { exact: true }).fill(projectName);
	await projectDialog
		.getByRole("button", { name: "Save", exact: true })
		.click();
	await expect(projectDialog).toBeHidden();
	await expect(
		page.getByRole("heading", { name: projectName, exact: true }),
	).toBeVisible();

	await page
		.getByRole("button", { name: `Edit ${projectName}`, exact: true })
		.click();
	await expect(projectDialog).toBeVisible();
	await expect(
		projectDialog.getByLabel("Name", { exact: true }),
	).toBeInViewport();
	await page.keyboard.press("Escape");
	await expect(projectDialog).toBeHidden();

	await page
		.getByRole("button", { name: "Batch Tagging", exact: true })
		.click();
	await expect(
		page.getByRole("heading", { name: "Batch AI Tagging", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Scan for Targets", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Start Batch Tagging", exact: true }),
	).toBeVisible();
	await expectNoHorizontalOverflow(page);

	await page.goto("/config");
	await expect(
		page.getByRole("heading", { name: "Settings", exact: true }),
	).toBeVisible();
	await waitForAppHydration(page);

	for (const category of [
		{ tab: "Jobs", heading: "Job Processing" },
		{ tab: "AI", heading: "AI Service" },
		{ tab: "Downloads", heading: "Downloads" },
		{ tab: "Storage", heading: "Storage" },
		{ tab: "Media", heading: "Media Extensions" },
		{ tab: "Logging", heading: "Logging" },
	]) {
		await page.getByRole("tab", { name: category.tab, exact: true }).click();
		await expect(
			page.getByRole("heading", { name: category.heading, exact: true }),
		).toBeVisible();
	}

	await page.getByRole("tab", { name: "Storage", exact: true }).click();
	const thumbnailDirectory = page.getByLabel("Thumbnail Directory", {
		exact: true,
	});
	await expect(thumbnailDirectory).toBeVisible();
	await expectNoHorizontalOverflow(page);

	if (mobileProjects.includes(testInfo.project.name)) {
		const fontSize = await thumbnailDirectory.evaluate((input) =>
			Number.parseFloat(getComputedStyle(input).fontSize),
		);
		expect(fontSize).toBeGreaterThanOrEqual(16);

		await page.getByRole("tab", { name: "Media", exact: true }).click();
		await page
			.getByLabel("Negative Tags", { exact: true })
			.scrollIntoViewIfNeeded();
		await expect(
			page.getByRole("button", { name: "Save Changes", exact: true }),
		).toBeInViewport();
	}
});
