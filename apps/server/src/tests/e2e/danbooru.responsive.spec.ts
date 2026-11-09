import type { Page } from "@playwright/test";
import {
	danbooruPostSchema,
	danbooruSearchSchema,
	type DanbooruSearch,
} from "@solid-imager/core/danbooru";
import { pendingImportJobSchema } from "@solid-imager/core/media";
import { z } from "zod";
import { expect, test } from "./support/test";

function post(id: number) {
	return danbooruPostSchema.parse({
		id,
		fileUrl: `https://cdn.donmai.us/original/${id}.png`,
		previewUrl: `https://cdn.donmai.us/preview/${id}.jpg`,
		sampleUrl: `https://cdn.donmai.us/sample/${id}.jpg`,
		fileExt: "png",
		width: 1200,
		height: 900,
		fileSize: 1000,
		rating: "g",
		score: id,
		createdAt: "2026-01-01T00:00:00Z",
		source: "https://example.org/art",
		tags: {
			general: ["landscape", "blue_sky"],
			artist: ["test_artist"],
			character: ["test_character"],
			copyright: ["test_series"],
			meta: ["highres"],
		},
	});
}

async function mockDanbooru(page: Page) {
	const searches: DanbooruSearch[] = [];
	await page.route("https://cdn.donmai.us/**", (route) =>
		route.fulfill({
			contentType: "image/svg+xml",
			body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#dae6e8"/><path d="M0 900 480 250 1200 900" fill="#608080"/></svg>',
		}),
	);
	await page.route(/\/api\/rpc\/(?:viewer|danbooru)\//, async (route) => {
		const method = new URL(route.request().url()).pathname.split("/").at(-1);
		const { json: input } = route.request().postDataJSON();
		let result: unknown;
		if (method === "search") {
			const query = danbooruSearchSchema.parse(input);
			searches.push(query);
			const start = query.page === 1 ? 101 : 201;
			result = {
				provider: "danbooru",
				posts: Array.from({ length: query.page === 1 ? 40 : 2 }, (_, i) =>
					post(start + i),
				),
				hasNextPage: query.page === 1,
			};
		} else if (method === "getPost") result = post(input.id);
		else result = [{ name: "landscape", category: 0, postCount: 1234 }];
		await route.fulfill({
			contentType: "application/json",
			body: JSON.stringify({ json: result }),
		});
	});
	return searches;
}

async function expectNoOverflow(page: Page) {
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth,
		),
	).toBe(true);
}

test("Danbooru sidebar, completion, pagination, viewer, imports and reload", async ({
	page,
}, testInfo) => {
	const searches = await mockDanbooru(page);
	const appPath = (path: string) =>
		testInfo.project.name === "tauri" ? `/#${path}` : path;
	await page.goto(appPath("/search"));
	const menu = page.getByRole("button", {
		name: "メニューを開く",
		exact: true,
	});
	if (await menu.isVisible()) await menu.click();
	await page
		.getByRole("link", { name: "Danbooru", exact: true })
		.filter({ visible: true })
		.click();
	await expect(
		page.getByRole("heading", { name: "Danbooru", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Danbooru #101 を開く", exact: true }),
	).toBeVisible();
	const input = page.getByRole("combobox", {
		name: "Danbooru を検索",
		exact: true,
	});
	await input.fill("land");
	await page.getByRole("option", { name: /landscape/ }).click();
	await expect(input).toHaveValue("landscape ");
	await page.getByRole("button", { name: "検索", exact: true }).click();
	await expect.poll(() => searches.at(-1)?.tags).toBe("landscape");
	await page.getByRole("button", { name: "次のページ", exact: true }).click();
	await expect(
		page.getByRole("link", { name: "Danbooru #201 を開く", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "次のページ", exact: true }),
	).toBeDisabled();
	await page.reload();
	await expect(input).toHaveValue("landscape ");
	await expect(
		page.getByRole("link", { name: "Danbooru #201 を開く", exact: true }),
	).toBeVisible();
	await expectNoOverflow(page);
	await page
		.getByRole("link", { name: "Danbooru #201 を開く", exact: true })
		.click();
	await expect(page).toHaveURL(/\/danbooru\/201$/);
	const detail = page.getByRole("region", {
		name: "Danbooru #201",
		exact: true,
	});
	await expect(detail).toBeVisible();
	await expect(input).toHaveCount(0);
	await expect(
		detail.getByRole("img", { name: "Danbooru #201", exact: true }),
	).toBeVisible();
	await expect(
		detail.getByRole("button", { name: "test_artist", exact: true }),
	).toBeVisible();
	await expectNoOverflow(page);
	await page.screenshot({
		path: testInfo.outputPath("danbooru-viewer.png"),
		animations: "disabled",
	});
	await detail
		.getByRole("button", { name: "Open Danbooru #201 image viewer" })
		.click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await expect(page).toHaveURL(/\/danbooru\/201$/);
	const added = page.waitForResponse(
		(response) =>
			new URL(response.url()).pathname === "/api/rpc/imports/bulkAdd" &&
			response.ok(),
	);
	await detail
		.getByRole("button", { name: "画像を取り込み待ちへ", exact: true })
		.click();
	await added;
	await expect(
		detail.getByRole("button", { name: "取り込み待ちに追加済み", exact: true }),
	).toBeDisabled();
	await page.getByRole("button", { name: "Close notification" }).click();
	const pending = await page.request.post("/api/rpc/imports/listPending", {
		data: { json: {} },
	});
	const jobs = z
		.array(pendingImportJobSchema)
		.parse((await pending.json()).json);
	const item = jobs.find((job) => job.item.targetUrl === post(201).fileUrl);
	expect(item?.item.authors?.[0].accountId).toBe("test_artist");
	expect(item?.item.characters?.[0].name).toBe("test_character");
	expect(item?.item.ips?.[0].name).toBe("test_series");
	if (item) {
		const cancelled = await page.request.post("/api/rpc/imports/cancel", {
			data: { json: { jobIds: [item.id] } },
		});
		expect(cancelled.ok()).toBe(true);
	}
	await detail.getByRole("button", { name: "次の投稿", exact: true }).click();
	await expect(
		page.getByRole("region", { name: "Danbooru #202", exact: true }),
	).toBeVisible();
	await page.goBack();
	await expect(
		page.getByRole("region", { name: "Danbooru #202", exact: true }),
	).toHaveCount(0);
	await expect(
		page.getByRole("link", { name: "Danbooru #201 を開く", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Danbooru #201 を開く", exact: true }),
	).toBeFocused();
	await page.goto(appPath("/danbooru/333"));
	await expect(
		page.getByRole("region", { name: "Danbooru #333", exact: true }),
	).toBeVisible();
	await page.reload();
	await expect(
		page
			.getByRole("region", { name: "Danbooru #333", exact: true })
			.getByRole("img", { name: "Danbooru #333", exact: true }),
	).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page).toHaveURL(/\/danbooru$/);
});

test("the collection restores the focused tile and scroll position after detail navigation", async ({
	page,
}, info) => {
	await mockDanbooru(page);
	await page.goto(info.project.name === "tauri" ? "/#/danbooru" : "/danbooru");
	const grid = page.getByRole("region", {
		name: "メディアグリッド",
		exact: true,
	});
	const first = grid.getByRole("link", { name: "Danbooru #101 を開く" });
	const last = grid.getByRole("link", { name: "Danbooru #140 を開く" });
	await first.focus();
	await first.press("ArrowRight");
	await expect(
		grid.getByRole("link", { name: "Danbooru #102 を開く" }),
	).toBeFocused();
	await page.keyboard.press("End");
	await expect(last).toBeFocused();
	const scroller = page.locator('[data-media-scroll="Danbooru"]');
	const scrollTop = await scroller.evaluate((el) => el.scrollTop);
	await last.press("Enter");
	const detail = page.getByRole("region", {
		name: "Danbooru #140",
		exact: true,
	});
	await expect(detail).toBeVisible();
	await detail.getByRole("button", { name: "一覧に戻る", exact: true }).click();
	await expect(last).toBeFocused();
	await expect
		.poll(() => scroller.evaluate((el) => el.scrollTop))
		.toBe(scrollTop);
});

test("Danbooru recovers failed requests without losing search input", async ({
	page,
	browserHealth,
}, testInfo) => {
	await mockDanbooru(page);
	browserHealth.allowResponseFailure("/api/rpc/viewer/search");
	browserHealth.allowConsole(
		"Failed to load resource: the server responded with a status of 503",
	);
	let fail = true;
	await page.route("**/api/rpc/viewer/search", async (route) => {
		if (fail)
			await route.fulfill({
				status: 503,
				contentType: "text/plain",
				body: "Service Unavailable",
			});
		else await route.fallback();
	});
	await page.goto(
		testInfo.project.name === "tauri" ? "/#/danbooru" : "/danbooru",
	);
	await expect(page.getByRole("alert")).toContainText(
		"Danbooru を取得できませんでした",
	);
	const input = page.getByRole("combobox", {
		name: "Danbooru を検索",
		exact: true,
	});
	await input.fill("rating:g");
	fail = false;
	await page.getByRole("button", { name: "再試行", exact: true }).click();
	await expect(
		page.getByRole("link", { name: "Danbooru #101 を開く", exact: true }),
	).toBeVisible();
	await expect(input).toHaveValue("rating:g");
	await expectNoOverflow(page);
});

test("the shared search field completes a tag at the caret and submits the full expression", async ({
	page,
}, info) => {
	const searches = await mockDanbooru(page);
	await page.goto(info.project.name === "tauri" ? "/#/danbooru" : "/danbooru");
	await expect(
		page.getByRole("link", { name: "Danbooru #101 を開く" }),
	).toBeVisible();
	const input = page.getByRole("combobox", { name: "Danbooru を検索" });
	await page.keyboard.press("/");
	await expect(input).toBeFocused();

	await input.fill("-lan ~cat");
	await input.press("Home");
	for (let i = 0; i < 4; i++) await input.press("ArrowRight");
	await expect(page.getByRole("option", { name: /landscape/ })).toBeVisible();
	await expect(input).toBeFocused();
	await input.press("ArrowDown");
	await input.press("Enter");
	await expect(input).toHaveValue("-landscape ~cat");
	await expect(input).toBeFocused();
	expect(
		await input.evaluate((el: HTMLInputElement) => el.selectionStart),
	).toBe("-landscape ".length);

	await input.press("Enter");
	await expect.poll(() => searches.at(-1)?.tags).toBe("-landscape ~cat");
});
