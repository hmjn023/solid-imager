import { expect, test } from "./support/test";

for (const width of [375, 1024, 1440]) {
	test(`job rows keep their geometry during progress and thumbnail updates at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		let releaseThumbnails: () => void = () => {};
		const thumbnailsReady = new Promise<void>((resolve) => {
			releaseThumbnails = resolve;
		});
		await page.route("**/job-thumbnail/**", async (route) => {
			await thumbnailsReady;
			if (route.request().url().endsWith("000000000000.webp")) {
				await route.fulfill({
					contentType: "image/svg+xml",
					body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="teal"/></svg>',
				});
				return;
			}
			await route.fulfill({
				contentType: "image/webp",
				body: "invalid thumbnail",
			});
		});
		await page.goto(`http://127.0.0.1:${process.env.E2E_GALLERY_PORT}/?jobs=1`);
		const table = page.getByRole("table");
		await expect(table.getByRole("row")).toHaveCount(4);
		await page.evaluate(() => document.fonts.ready.then(() => {}));
		const geometry = () =>
			table.locator("tbody tr").evaluateAll((rows) =>
				rows.map((row) => ({
					height: row.getBoundingClientRect().height,
					cells: [...row.children].map((cell) => ({
						x: cell.getBoundingClientRect().x,
						width: cell.getBoundingClientRect().width,
					})),
				})),
			);
		const before = await geometry();
		await page.getByRole("button", { name: "Advance jobs" }).click();
		await expect(table.getByRole("progressbar")).toHaveCount(3);
		expect(await geometry()).toEqual(before);
		releaseThumbnails();
		await expect(table.locator("img")).toHaveCount(1);
		await expect
			.poll(() =>
				table
					.locator("img")
					.evaluate(
						(image: HTMLImageElement) =>
							image.complete && image.naturalWidth > 0,
					),
			)
			.toBe(true);
		expect(await geometry()).toEqual(before);
		await page.getByRole("button", { name: "Advance jobs" }).click();
		await expect(table.getByRole("progressbar").first()).toHaveAttribute(
			"aria-valuenow",
			"100",
		);
		expect(await geometry()).toEqual(before);
		await page.getByRole("button", { name: "Advance jobs" }).click();
		await expect(table.getByText("Completed", { exact: true })).toHaveCount(3);
		expect(await geometry()).toEqual(before);
		expect(
			await page.evaluate(
				() =>
					document.documentElement.scrollWidth -
					document.documentElement.clientWidth,
			),
		).toBeLessThanOrEqual(1);
	});
}
