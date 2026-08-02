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

test("virtual media grid stays populated and DOM-bounded during fast scrolling", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1_280, height: 720 });
	await page.goto(`${getGalleryUrl()}/?virtual-grid=1`);
	await expect(
		page.getByRole("heading", {
			name: "Virtual media grid performance fixture",
		}),
	).toBeAttached();

	const scroller = page.getByTestId("virtual-grid-scroller");
	await expect(scroller.locator("[data-media-id]").first()).toBeVisible();

	const samples = await scroller.evaluate(async (element) => {
		const sampleRows: Array<{
			mounted: number;
			visible: number;
			loadedVisible: number;
			firstVisibleId: string | null;
		}> = [];
		const settleFrame = () =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
			);

		for (let step = 0; step <= 20; step += 1) {
			element.scrollTop =
				(element.scrollHeight - element.clientHeight) * (step / 20);
			await settleFrame();

			const scrollerRect = element.getBoundingClientRect();
			const mounted = [
				...element.querySelectorAll<HTMLElement>("[data-media-id]"),
			];
			const visible = mounted.filter((item) => {
				const rect = item.getBoundingClientRect();
				return rect.bottom > scrollerRect.top && rect.top < scrollerRect.bottom;
			});
			const loadedVisible = visible.filter((item) => {
				const image = item.querySelector("img");
				return image?.complete && image.naturalWidth > 0;
			});
			sampleRows.push({
				mounted: mounted.length,
				visible: visible.length,
				loadedVisible: loadedVisible.length,
				firstVisibleId: visible[0]?.dataset.mediaId ?? null,
			});
		}

		return sampleRows;
	});

	expect(samples.every((sample) => sample.mounted > 0)).toBe(true);
	expect(Math.max(...samples.map((sample) => sample.mounted))).toBeLessThan(
		100,
	);
	expect(samples.every((sample) => sample.visible > 0)).toBe(true);
	expect(
		samples.every((sample) => sample.loadedVisible === sample.visible),
	).toBe(true);
	expect(
		new Set(samples.map((sample) => sample.firstVisibleId)).size,
	).toBeGreaterThan(10);
});
