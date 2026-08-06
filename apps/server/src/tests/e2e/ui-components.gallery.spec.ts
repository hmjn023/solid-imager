import { expect, type Locator, test } from "@playwright/test";

function getGalleryUrl(): string {
	const port = process.env.E2E_GALLERY_PORT;
	if (!port) {
		throw new Error("E2E_GALLERY_PORT must be set by the E2E runner");
	}
	return `http://127.0.0.1:${port}`;
}

async function expectVisibleImagesLoaded(scroller: Locator): Promise<void> {
	await expect
		.poll(() =>
			scroller.evaluate((element) => {
				const scrollerRect = element.getBoundingClientRect();
				const visibleImages = [
					...element.querySelectorAll<HTMLImageElement>("[data-media-id] img"),
				].filter((image) => {
					const rect = image.getBoundingClientRect();
					return (
						rect.bottom > scrollerRect.top && rect.top < scrollerRect.bottom
					);
				});
				return (
					visibleImages.length > 0 &&
					visibleImages.every(
						(image) => image.complete && image.naturalWidth > 0,
					)
				);
			}),
		)
		.toBe(true);
}

async function expectResponsiveThumbnailWidth(
	scroller: Locator,
	expectedWidth: 256 | 512,
): Promise<void> {
	await expect
		.poll(() =>
			scroller.evaluate((element, width) => {
				const image = element.querySelector<HTMLImageElement>(
					"[data-media-id] img",
				);
				return (
					image?.complete === true &&
					image.naturalWidth > 0 &&
					image.currentSrc.endsWith(`-${width}.webp`)
				);
			}, expectedWidth),
		)
		.toBe(true);
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
	await page.addInitScript(() =>
		performance.setResourceTimingBufferSize(5_000),
	);
	await page.setViewportSize({ width: 1_280, height: 720 });
	await page.goto(`${getGalleryUrl()}/?virtual-grid=1`);
	await expect(
		page.getByRole("heading", {
			name: "Virtual media grid performance fixture",
		}),
	).toBeAttached();

	const scroller = page.getByTestId("virtual-grid-scroller");
	await expect(scroller.locator("[data-media-id]").first()).toBeVisible();
	await expectVisibleImagesLoaded(scroller);
	await expectResponsiveThumbnailWidth(scroller, 256);

	const scrollDownSamples = await scroller.evaluate(async (element) => {
		const samples: Array<{
			above: number;
			below: number;
			mounted: number;
			srcImages: number;
			visible: number;
			firstVisibleId: string | null;
		}> = [];
		const nextPaint = () =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
			);
		for (let step = 0; step <= 48; step += 1) {
			element.scrollTop =
				(element.scrollHeight - element.clientHeight) * (step / 48);
			await nextPaint();

			const scrollerRect = element.getBoundingClientRect();
			const mounted = [
				...element.querySelectorAll<HTMLElement>("[data-media-id]"),
			];
			const visible = mounted.filter((item) => {
				const rect = item.getBoundingClientRect();
				return rect.bottom > scrollerRect.top && rect.top < scrollerRect.bottom;
			});
			samples.push({
				above: mounted.filter(
					(item) => item.getBoundingClientRect().bottom <= scrollerRect.top,
				).length,
				below: mounted.filter(
					(item) => item.getBoundingClientRect().top >= scrollerRect.bottom,
				).length,
				mounted: mounted.length,
				srcImages: mounted.filter((item) => item.querySelector("img[src]"))
					.length,
				visible: visible.length,
				firstVisibleId: visible[0]?.dataset.mediaId ?? null,
			});
		}

		return samples;
	});

	expect(scrollDownSamples.every((sample) => sample.mounted > 0)).toBe(true);
	expect(
		Math.max(...scrollDownSamples.map((sample) => sample.mounted)),
	).toBeLessThan(160);
	expect(
		Math.max(...scrollDownSamples.map((sample) => sample.srcImages)),
	).toBeLessThan(160);
	expect(
		scrollDownSamples.every((sample) => sample.srcImages >= sample.visible),
	).toBe(true);
	expect(scrollDownSamples.every((sample) => sample.visible > 0)).toBe(true);
	expect(
		new Set(scrollDownSamples.map((sample) => sample.firstVisibleId)).size,
	).toBeGreaterThan(10);
	expect(
		Math.max(...scrollDownSamples.map((sample) => sample.below)),
	).toBeGreaterThan(20);
	expect(
		Math.max(...scrollDownSamples.map((sample) => sample.above)),
	).toBeGreaterThan(20);

	// Loading is allowed while the user is moving, but stopping must leave no
	// blank thumbnails in the viewport.
	await expectVisibleImagesLoaded(scroller);

	const scrollUpSamples = await scroller.evaluate(async (element) => {
		const samples: Array<{
			mounted: number;
			srcImages: number;
			visible: number;
		}> = [];
		const nextPaint = () =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
			);
		for (let step = 47; step >= 0; step -= 1) {
			element.scrollTop =
				(element.scrollHeight - element.clientHeight) * (step / 48);
			await nextPaint();
			const scrollerRect = element.getBoundingClientRect();
			const mounted = [
				...element.querySelectorAll<HTMLElement>("[data-media-id]"),
			];
			samples.push({
				mounted: mounted.length,
				srcImages: mounted.filter((item) => item.querySelector("img[src]"))
					.length,
				visible: mounted.filter((item) => {
					const rect = item.getBoundingClientRect();
					return (
						rect.bottom > scrollerRect.top && rect.top < scrollerRect.bottom
					);
				}).length,
			});
		}
		return samples;
	});

	expect(scrollUpSamples.every((sample) => sample.mounted > 0)).toBe(true);
	expect(scrollUpSamples.every((sample) => sample.visible > 0)).toBe(true);
	expect(
		scrollUpSamples.every((sample) => sample.srcImages >= sample.visible),
	).toBe(true);
	expect(
		Math.max(...scrollUpSamples.map((sample) => sample.mounted)),
	).toBeLessThan(160);
	expect(
		Math.max(...scrollUpSamples.map((sample) => sample.srcImages)),
	).toBeLessThan(160);
	await expectVisibleImagesLoaded(scroller);

	const transferSummary = await page.evaluate(() => {
		const resources = (
			performance.getEntriesByType("resource") as PerformanceResourceTiming[]
		).filter((entry) => entry.name.includes("/virtual-thumbnail/"));
		const positiveTransfers = resources.filter(
			(entry) => entry.transferSize > 0,
		);
		const transfersByUrl = new Map<string, number>();
		for (const entry of positiveTransfers) {
			transfersByUrl.set(entry.name, (transfersByUrl.get(entry.name) ?? 0) + 1);
		}
		return {
			positiveTransferCount: positiveTransfers.length,
			retransferredUrls: [...transfersByUrl.entries()].filter(
				([, count]) => count > 1,
			),
		};
	});
	expect(transferSummary.positiveTransferCount).toBeGreaterThan(0);
	expect(transferSummary.retransferredUrls).toEqual([]);
});

test("virtual media grid stays populated after restoring a deep scroll position", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1_280, height: 720 });
	await page.goto(`${getGalleryUrl()}/?virtual-grid=1&restore-grid=1`);

	const scroller = page.getByTestId("virtual-grid-scroller");
	await expect(scroller.locator("[data-media-id]").first()).toBeVisible();
	await expect
		.poll(() => scroller.evaluate((element) => element.scrollHeight))
		.toBeGreaterThan(1_000);
	const maxScrollTop = await scroller.evaluate(
		(element) => element.scrollHeight - element.clientHeight,
	);
	await expect
		.poll(() => scroller.evaluate((element) => element.scrollTop))
		.toBeGreaterThan(maxScrollTop * 0.9);
	await expectVisibleImagesLoaded(scroller);

	await scroller.evaluate((element) => {
		element.scrollTop += element.clientHeight * 2;
	});
	await expectVisibleImagesLoaded(scroller);
});

test("virtual media grid preserves offset after a route-style remount and page update", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1_280, height: 720 });
	await page.goto(`${getGalleryUrl()}/?virtual-grid=1&remount-grid=1`);

	const scroller = page.getByTestId("virtual-grid-scroller");
	await expect(scroller.locator("[data-media-id]").first()).toBeVisible();
	await scroller.evaluate(async (element) => {
		element.scrollTop = 1_500;
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
		);
	});
	const beforeRemount = await scroller.evaluate((element) => element.scrollTop);
	expect(beforeRemount).toBeGreaterThan(500);

	await page.getByTestId("remount-virtual-grid").click();
	await expect
		.poll(() => scroller.evaluate((element) => element.scrollTop))
		.toBeGreaterThan(beforeRemount - 2);
	await page.evaluate(() =>
		window.dispatchEvent(new WheelEvent("wheel", { deltaY: 1 })),
	);
	const restoredTop = await scroller.evaluate((element) => element.scrollTop);
	const heightBeforeAppend = await scroller.evaluate(
		(element) => element.scrollHeight,
	);
	const nextTop = restoredTop + 1_800;

	await page.evaluate((targetTop) => {
		const element = document.querySelector<HTMLElement>(
			"[data-testid=virtual-grid-scroller]",
		);
		if (!element) throw new Error("Virtual grid scroller was not found");
		element.scrollTop = 0;
		document
			.querySelector<HTMLElement>("[data-testid=append-virtual-grid-page]")
			?.click();
		requestAnimationFrame(() => {
			element.scrollTop = targetTop;
		});
	}, nextTop);
	await expect
		.poll(() => scroller.evaluate((element) => element.scrollHeight))
		.toBeGreaterThan(heightBeforeAppend);
	await expect
		.poll(() => scroller.evaluate((element) => element.scrollTop))
		.toBeGreaterThan(restoredTop + 1_700);
	await expectVisibleImagesLoaded(scroller);
});

test("virtual media grid preserves offset while fast scrolling starts a page fetch", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1_280, height: 720 });
	await page.goto(`${getGalleryUrl()}/?virtual-grid=1&remount-grid=1`);

	const scroller = page.getByTestId("virtual-grid-scroller");
	await expect(scroller.locator("[data-media-id]").first()).toBeVisible();
	await scroller.evaluate(async (element) => {
		element.scrollTop = 1_500;
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
		);
	});

	await page.getByTestId("remount-virtual-grid").click();
	await expect
		.poll(() => scroller.evaluate((element) => element.scrollTop))
		.toBeGreaterThan(1_400);
	await page.evaluate(() =>
		window.dispatchEvent(new WheelEvent("wheel", { deltaY: 1 })),
	);

	const restoredTop = await scroller.evaluate((element) => element.scrollTop);
	await scroller.evaluate((element) => {
		element.scrollTop = element.scrollHeight - element.clientHeight - 1;
	});

	await expect(page.getByText("読み込み中...", { exact: true })).toBeVisible();
	await expect(page.getByText("読み込み中...", { exact: true })).toHaveCount(0);
	await expect
		.poll(() => scroller.evaluate((element) => element.scrollTop))
		.toBeGreaterThan(restoredTop + 1_000);
});

test.describe("high-density virtual media grid", () => {
	test.use({ deviceScaleFactor: 2 });

	test("selects the 512px WebP candidate at DPR 2", async ({ page }) => {
		await page.setViewportSize({ width: 1_280, height: 720 });
		await page.goto(`${getGalleryUrl()}/?virtual-grid=1`);
		const scroller = page.getByTestId("virtual-grid-scroller");
		await expect(scroller.locator("[data-media-id]").first()).toBeVisible();
		await expectVisibleImagesLoaded(scroller);
		await expectResponsiveThumbnailWidth(scroller, 512);
	});
});
