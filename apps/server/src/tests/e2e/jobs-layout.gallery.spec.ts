import { expectDomPreserved } from "./support/dom";
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
		await expect(table.getByText("完了", { exact: true })).toHaveCount(3);
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

test("background updates preserve job rows, focus, and filter controls", async ({
	page,
}) => {
	await page.goto(`http://127.0.0.1:${process.env.E2E_GALLERY_PORT}/?jobs=1`);
	const table = page.getByRole("table");
	await expect(table.getByRole("row")).toHaveCount(4);
	await page.getByRole("button", { name: "Start background refresh" }).click();
	const types = page.getByRole("combobox", { name: "ジョブの種類で絞り込む" });
	await expect(types).toBeEnabled();
	const jobButton = table.locator("tbody tr").first().getByRole("button");
	await jobButton.focus();
	await jobButton.evaluate((button) =>
		button.setAttribute("data-preserved", "true"),
	);
	await page
		.getByRole("button", { name: "Advance jobs" })
		.evaluate((button: HTMLButtonElement) => button.click());
	await expect(table.getByRole("progressbar")).toHaveCount(3);
	await expect(jobButton).toBeFocused();
	await expect(jobButton).toHaveAttribute("data-preserved", "true");
	await expect(types).toBeEnabled();
});

test(
	"changing the job status filter reuses the results panel and rows",
	{ tag: "@dom-stability" },
	async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto(`http://127.0.0.1:${process.env.E2E_GALLERY_PORT}/?jobs=1`);
		const panel = page.getByRole("tabpanel");
		const rows = panel.locator("tbody tr");
		await expect(rows).toHaveCount(3);
		const statusTabs = page.getByRole("tablist", {
			name: "ジョブの状態で絞り込む",
		});
		await expect(statusTabs).toHaveAttribute("aria-orientation", "vertical");
		await expectDomPreserved({ panel, firstRow: rows.first() }, async () => {
			const allTab = statusTabs.getByRole("tab", { selected: true });
			const activeTab = statusTabs.getByRole("tab", {
				name: /^実行中・待機中/,
			});
			await allTab.press("ArrowDown");
			await expect(activeTab).toHaveAttribute("aria-selected", "true");
			await expect(activeTab).toBeFocused();
			await expect(panel).toHaveAccessibleName(/^実行中・待機中/);
			await expect(activeTab).toHaveAttribute(
				"aria-controls",
				(await panel.getAttribute("id")) ?? "",
			);
			await expect(rows).toHaveCount(3);
		});

		await expectDomPreserved({ panel }, async () => {
			await page.keyboard.press("ArrowDown");
			await expect(
				statusTabs.getByRole("tab", { name: /^失敗/ }),
			).toBeFocused();
			await expect(
				panel.getByText("条件に一致するジョブがありません"),
			).toBeVisible();
			await page.keyboard.press("ArrowUp");
			await expect(
				statusTabs.getByRole("tab", { name: /^実行中・待機中/ }),
			).toBeFocused();
			await expect(rows).toHaveCount(3);
		});
	},
);

test("bulk retry controls fit after returning to the job list", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1024, height: 768 });
	await page.goto(
		`http://127.0.0.1:${process.env.E2E_GALLERY_PORT}/?jobs=1&jobDetails=1`,
	);
	await expect(
		page.getByRole("complementary", { name: "ジョブの詳細" }),
	).toBeVisible();
	await page.getByRole("button", { name: "一覧へ戻る" }).click();
	const selectAll = page.getByText("失敗したジョブをすべて選択", {
		exact: true,
	});
	const apply = page.getByRole("button", { name: "適用", exact: true });
	await expect(apply).toBeDisabled();
	await expect(apply).toBeInViewport({ ratio: 1 });
	expect((await selectAll.boundingBox())?.height).toBeLessThan(32);
	await selectAll.click();
	await expect(page.getByText("失敗した1件中1件を選択")).toBeVisible();
	await page.getByRole("combobox", { name: "ジョブの一括操作" }).click();
	await page.getByRole("option", { name: "失敗したジョブを再試行" }).click();
	await expect(apply).toBeEnabled();
	await expect(apply).toBeInViewport({ ratio: 1 });
	await apply.click();
	await expect(apply).toBeDisabled();
});

for (const width of [390, 1440]) {
	test(`batch detail keeps summary visible and returns to the list at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
		let releaseImages!: () => void;
		const imageGate = new Promise<void>((resolve) => {
			releaseImages = resolve;
		});
		await page.route("**/virtual-thumbnail/**", async (route) => {
			await imageGate;
			await route.continue();
		});
		await page.goto(
			`http://127.0.0.1:${process.env.E2E_GALLERY_PORT}/?jobs=1&jobDetails=1`,
		);
		const detail = page.getByRole("complementary", { name: "ジョブの詳細" });
		const targets = detail.getByRole("table", { name: "バッチの処理対象" });
		await expect(targets.locator("tbody tr")).toHaveCount(25);
		const firstRow = targets.locator("tbody tr").first();
		const beforeImage = await firstRow.boundingBox();
		releaseImages();
		const thumbnail = firstRow.locator("img");
		await expect
			.poll(() =>
				thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth),
			)
			.toBeGreaterThan(0);
		expect(await firstRow.boundingBox()).toEqual(beforeImage);
		await expect(targets.locator("tbody tr").last().locator("img")).toHaveCount(
			0,
		);
		await expect(
			detail.getByText("完了 68 · 失敗 2 · 残り 30", { exact: true }),
		).toBeVisible();
		const cancel = detail.getByRole("button", {
			name: "一括取り込みをキャンセル",
		});
		await expect(cancel).toBeVisible();
		await page.screenshot({
			path: `/tmp/jobs-detail-${width}.png`,
			fullPage: true,
		});
		const before = await cancel.boundingBox();
		await targets.locator("tbody tr").last().scrollIntoViewIfNeeded();
		await expect(cancel).toBeInViewport();
		expect(await cancel.boundingBox()).toEqual(before);
		await detail.getByRole("button", { name: "次へ", exact: true }).click();
		await expect(targets).toContainText("forest-evening-026.png");
		const info = detail.getByRole("button", { name: "実行情報・ジョブID" });
		await info.scrollIntoViewIfNeeded();
		await info.click();
		await expect(
			detail
				.getByText("00000000-0000-4000-8000-000000000000", { exact: true })
				.first(),
		).toBeVisible();
		await detail.getByRole("button", { name: "一覧へ戻る" }).click();
		await expect(detail).toBeHidden();
		const selected = page.getByRole("button", { name: /一括取り込みジョブ/ });
		await expect(selected).toBeFocused();
		await selected.click();
		await expect(detail).toBeVisible();
		expect(
			await page.evaluate(
				() =>
					document.documentElement.scrollWidth -
					document.documentElement.clientWidth,
			),
		).toBeLessThanOrEqual(1);
	});
}
