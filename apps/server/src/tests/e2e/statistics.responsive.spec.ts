import { E2E_SOURCE_ID } from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

test("statistics switches period and keeps the monthly drill-down across reload", async ({
	page,
}) => {
	await page.goto("/statistics");
	await waitForAppHydration(page);
	await expect(
		page.getByRole("heading", { name: "ライブラリ統計" }),
	).toBeVisible();
	await expect(page.getByRole("button", { name: "全期間" })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expect(page.locator(".ts-chart-host svg").first()).toBeVisible();
	await expect(page.getByText(/月別 · 期間計/)).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "IPランキング" }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "キャラクターランキング" }),
	).toBeVisible();
	await page.getByText("件数を一覧で見る").click();
	await page
		.getByRole("button", { name: /^\d{4}-\d{2} [1-9]\d*件$/ })
		.last()
		.click();
	const firstMedia = page
		.getByRole("main")
		.getByRole("link", { name: /\.png$/ })
		.first();
	await expect(firstMedia).toBeVisible();
	const href = await firstMedia.getAttribute("href");
	expect(href).toContain("/sources/" + E2E_SOURCE_ID + "/");
	await page.reload();
	await expect(firstMedia).toHaveAttribute("href", href ?? "");
	await expect(
		page.getByRole("button", { name: "全期間", exact: true }),
	).toHaveAttribute("aria-pressed", "true");
	await page.getByRole("button", { name: "直近30日" }).click();
	await expect(page.getByText(/日別 · 期間計/)).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "該当するメディア" }),
	).toHaveCount(0);
	expect(
		await page.evaluate(
			() =>
				document.documentElement.scrollWidth -
				document.documentElement.clientWidth,
		),
	).toBeLessThanOrEqual(1);
});

test("statistics opens from the sidebar and recovers a failed request @desktop-only", async ({
	page,
	browserHealth,
}) => {
	const endpoint = "**/api/rpc/media/statistics";
	browserHealth.allowResponseFailure("/api/rpc/media/statistics");
	browserHealth.allowConsole(/503 \(Service Unavailable\)/);
	await page.route(endpoint, (route) =>
		route.fulfill({ status: 503, json: { message: "Statistics unavailable" } }),
	);
	await page.goto("/about");
	await waitForAppHydration(page);
	await page.getByRole("link", { name: "統計", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "統計を取得できませんでした" }),
	).toBeVisible();
	await page.unroute(endpoint);
	await page.getByRole("button", { name: "再試行", exact: true }).click();
	await expect(
		page.getByRole("img", { name: "メディアの取り込み件数" }),
	).toBeVisible();
});

test("chart views show composition, cumulative counts and selectable ranking bars", async ({
	page,
}, testInfo) => {
	const counts = [
		9, 16, 12, 21, 7, 4, 0, 18, 29, 21, 38, 16, 10, 8, 20, 34, 18, 57, 41, 23,
		14, 0, 12, 31, 27, 20, 43, 26, 16, 35,
	];
	let cumulative = 1000;
	const trend = counts.map((count, i) => ({
		bucket: `2026-10-${String(i + 1).padStart(2, "0")}`,
		count,
		cumulative: (cumulative += count),
	}));
	const total = counts.reduce((sum, value) => sum + value, 0);
	const entities = (names: string[], values: number[]) =>
		names.map((name, index) => ({
			id: `abc00000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
			name,
			count: values[index],
		}));
	const ips = entities(
		["星の航路", "夜明けのアトリエ", "機械仕掛けの庭", "雨の図書館"],
		[214, 155, 92, 63],
	);
	const characters = entities(
		["澪", "アリア", "ルカ", "凪"],
		[131, 98, 76, 54],
	);
	await page.route("**/api/rpc/media/statistics", (route) => {
		const filtered = route.request().postDataJSON().json.ipId === ips[0].id;
		return route.fulfill({
			json: {
				json: {
					trend,
					ips,
					characters: filtered ? characters.slice(0, 1) : characters,
					models: filtered
						? []
						: [
								{ name: "Atelier XL", count: 180, favorites: 63 },
								{ name: "Linea v3", count: 106, favorites: 51 },
								{ name: "Scene Study", count: 64, favorites: 17 },
							],
					mediaTypes: filtered
						? [{ type: "image", count: 214 }]
						: [
								{ type: "image", count: total - 147 },
								{ type: "video", count: 112 },
								{ type: "audio", count: 35 },
							],
					media: [],
					hasMore: false,
				},
			},
		});
	});
	await page.goto("/statistics?period=recent");
	await waitForAppHydration(page);
	await expect(
		page.getByRole("img", { name: "画像・動画・音声の構成比" }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "生成モデル別のお気に入り" }),
	).toBeAttached();
	await expect(page.getByText("63 / 180件", { exact: true })).toBeAttached();
	const leading = page.getByRole("button", { name: /星の航路/ });
	const runnerUp = page.getByRole("button", { name: /夜明けのアトリエ/ });
	const width = (button: typeof leading) =>
		button.locator("rect").evaluate((el) => el.getBoundingClientRect().width);
	const leadingWidth = await width(leading);
	expect(leadingWidth).toBeGreaterThan(80);
	expect((await width(runnerUp)) / leadingWidth).toBeCloseTo(155 / 214, 1);
	await page.screenshot({
		path: testInfo.outputPath("statistics-overview.png"),
		animations: "disabled",
	});
	await page.getByRole("button", { name: "累計", exact: true }).click();
	await expect(
		page.getByRole("img", { name: "ライブラリの累計メディア数" }),
	).toBeVisible();
	await page.getByText("件数を一覧で見る").click();
	await expect(
		page.getByRole("button", {
			name: `2026-10-30 ${(1000 + total).toLocaleString("ja-JP")}件`,
			exact: true,
		}),
	).toBeVisible();
	await page.getByText("件数を一覧で見る").click();
	await leading.click();
	await expect(leading).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByText("214件", { exact: true }).first()).toBeVisible();
	await expect(page.getByRole("button", { name: /アリア/ })).toHaveCount(0);
	await expect(
		page.getByRole("img", { name: "ライブラリの累計メディア数" }),
	).toBeAttached();
	expect(
		await page.evaluate(
			() =>
				document.documentElement.scrollWidth -
				document.documentElement.clientWidth,
		),
	).toBeLessThanOrEqual(1);
});
