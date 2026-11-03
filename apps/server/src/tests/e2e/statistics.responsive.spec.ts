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
	await expect(page.getByRole("button", { name: "直近30日" })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expect(page.locator(".ts-chart-host svg").first()).toBeVisible();
	await page.getByRole("button", { name: "全期間", exact: true }).click();
	await expect(page.getByText(/月別 · 計/)).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "IPランキング" }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "キャラクターランキング" }),
	).toBeVisible();
	await page.getByText("件数を一覧で見る").click();
	await page
		.getByRole("button", { name: /^\d{4}-\d{2} [1-9]\d* 件$/ })
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
	await expect(page.getByText(/日別 · 計/)).toBeVisible();
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
	await page.getByRole("link", { name: "Statistics", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "統計を取得できませんでした" }),
	).toBeVisible();
	await page.unroute(endpoint);
	await page.getByRole("button", { name: "再試行", exact: true }).click();
	await expect(
		page.getByRole("img", { name: "メディアの取り込み件数" }),
	).toBeVisible();
});
