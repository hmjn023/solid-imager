import { expect, test, waitForAppHydration } from "./support/test";
import type { Locator, Page } from "@playwright/test";
import {
	viewerRequestSchema,
	pixivArtworkSchema,
	pixivBookmarkChangeSchema,
	type PixivBookmarkChange,
	type PixivArtwork,
} from "@solid-imager/core/external-viewer";
import { pendingImportJobSchema } from "@solid-imager/core/media";
import { z } from "zod";

async function navigateTo(page: Page, name: string) {
	const menu = page.getByRole("button", {
		name: "メニューを開く",
		exact: true,
	});
	if ((page.viewportSize()?.width ?? 1280) < 768) await menu.click();
	await page
		.getByRole("link", { name, exact: true })
		.filter({ visible: true })
		.click();
}

function pixivActions(page: Page) {
	return page.getByRole("button", { name: "その他の操作", exact: true });
}

async function openPixivAction(page: Page, name: string) {
	await pixivActions(page).click();
	await page.getByRole("menuitem", { name, exact: true }).click();
}

const base = "https://i.pximg.net/img-original/img/2026/01/01/00/00/00/123_p";
const artwork = pixivArtworkSchema.parse({
	id: 123,
	title: "海の風景",
	author: "作者名",
	userId: "23",
	thumbnail: base + "0.png",
	createdAt: "2026-01-01T00:00:00Z",
	isAnimation: false,
	tags: ["風景"],
	pageCount: 2,
	pages: [0, 1].map((i) => ({
		preview: base + i + ".png",
		original: base + i + ".png",
		width: 640,
		height: 400,
	})),
});
async function mockPixivImage(page: Page) {
	await page.route("**/api/rpc/viewer/pixivRelatedPage", (route) =>
		route.fulfill({ json: { json: { posts: [], nextIds: [] } } }),
	);
	await page.route("**/api/pixiv-image?*", (route) =>
		route.fulfill({
			contentType: "image/png",
			body: Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cF1kAAAAASUVORK5CYII=",
				"base64",
			),
		}),
	);
}

async function mockPixivDetail(page: Page, work: PixivArtwork) {
	await mockPixivImage(page);
	await page.route("**/api/rpc/viewer/search", (route) =>
		route.fulfill({
			json: {
				json: {
					provider: "pixiv",
					posts: [work],
					hasNextPage: false,
					word: "",
					mappings: [],
				},
			},
		}),
	);
	await page.route("**/api/rpc/viewer/pixivArtwork", (route) =>
		route.fulfill({ json: { json: work } }),
	);
}

async function pendingImports(page: Page) {
	const response = await page.request.post("/api/rpc/imports/listPending", {
		data: { json: {} },
	});
	expect(response.ok()).toBe(true);
	return z.array(pendingImportJobSchema).parse((await response.json()).json);
}

test("switches the same canonical tag between viewers, chooses a pixiv name and imports the selected page", async ({
	page,
}, info) => {
	const path = (s: string) => (info.project.name === "tauri" ? "/#" + s : s);
	await mockPixivImage(page);
	const requests: z.infer<typeof viewerRequestSchema>[] = [];
	await page.route("**/api/rpc/viewer/**", async (route) => {
		if (route.request().url().endsWith("/pixivRelatedPage")) {
			await route.fulfill({ json: { json: { posts: [], nextIds: [] } } });
			return;
		}
		const procedure = new URL(route.request().url()).pathname.split("/").at(-1);
		let result: unknown;
		if (procedure === "pixivArtwork") result = artwork;
		else if (procedure === "suggestTags")
			result = [{ name: "landscape", category: 0, postCount: 20 }];
		else {
			const input = viewerRequestSchema.parse(
				route.request().postDataJSON().json,
			);
			requests.push(input);
			const word = input.choices?.landscape ?? "風景";
			result =
				input.provider === "danbooru"
					? { provider: "danbooru", posts: [], hasNextPage: false }
					: {
							provider: "pixiv",
							posts: [artwork],
							hasNextPage: false,
							word,
							mappings: [
								{
									tag: "landscape",
									selected: word,
									names: ["風景", "風景画", "landscape"],
									source: "wiki",
								},
							],
						};
		}
		await route.fulfill({ json: { json: result } });
	});
	await page.goto(path("/danbooru"));
	if (info.project.name !== "tauri") await waitForAppHydration(page);
	const input = page.getByRole("combobox", { name: "Danbooru を検索" });
	await input.fill("land");
	await page.getByRole("option", { name: /landscape/ }).click();
	await page.getByRole("button", { name: "検索", exact: true }).click();
	await expect.poll(() => requests.at(-1)?.tags).toBe("landscape");
	await navigateTo(page, "pixiv");
	await expect(
		page.getByRole("combobox", { name: "pixiv を検索" }),
	).toHaveValue("");
	await expect.poll(() => requests.at(-1)?.provider).toBe("pixiv");
	expect(requests.at(-1)?.tags).toBe("landscape");
	await page.getByRole("button", { name: "landscape の pixiv タグ" }).click();
	await page.getByRole("option", { name: "風景画", exact: true }).click();
	await expect.poll(() => requests.at(-1)?.choices?.landscape).toBe("風景画");
	await page.getByRole("link", { name: "海の風景 を開く" }).click();
	await page.reload();
	const detail = page.getByRole("region", { name: "pixiv #123" });
	await expect(detail).toBeVisible();
	await detail.getByRole("button", { name: "次の画像", exact: true }).click();
	await expect(detail.getByRole("img", { name: "海の風景" })).toHaveAttribute(
		"src",
		/123_p1/,
	);
	await detail
		.getByRole("button", { name: "この画像を取り込み待ちへ" })
		.click();
	await expect(
		detail.getByRole("button", { name: "取り込み待ちに追加済み" }),
	).toBeDisabled();
	const jobs = await pendingImports(page);
	const job = jobs.find((x) => x.item.targetUrl === base + "1.png");
	expect(job?.item.sourceUrls?.at(-1)).toBe(
		"https://www.pixiv.net/artworks/123",
	);
	if (job)
		await page.request.post("/api/rpc/imports/cancel", {
			data: { json: { jobIds: [job.id] } },
		});
	await page.keyboard.press("Escape");
	await expect(page).toHaveURL(/\/pixiv$/);
	await navigateTo(page, "Danbooru");
	await expect(
		page.getByRole("combobox", { name: "Danbooru を検索" }),
	).toHaveValue("landscape ");
});

test("keeps Pixiv browsing controls on one row and describes empty results by collection", async ({
	page,
}, info) => {
	await page.route("**/api/rpc/viewer/search", (route) => {
		const input = viewerRequestSchema.parse(
			route.request().postDataJSON().json,
		);
		return route.fulfill({
			json: {
				json: {
					provider: "pixiv",
					posts: [],
					hasNextPage: false,
					word: input.tags,
					mappings: [],
				},
			},
		});
	});
	await page.route("**/api/rpc/viewer/suggestTags", (route) =>
		route.fulfill({ json: { json: [] } }),
	);
	await page
		.context()
		.route("https://www.pixiv.net/**", (route) =>
			route.fulfill({ contentType: "text/html", body: "<title>pixiv</title>" }),
		);
	await page.goto(info.project.name === "tauri" ? "/#/pixiv" : "/pixiv");
	await expect(
		page.getByText("別のランキングを選ぶか、タグで作品を検索してください。"),
	).toBeVisible();
	const heading = page.getByRole("heading", { name: "pixiv", exact: true });
	const search = page.getByRole("button", { name: "検索", exact: true });
	const resultCount = page
		.locator("header")
		.getByText("0件を表示", { exact: true });
	const actions = pixivActions(page);
	const feed = page.getByRole("button", { name: /^表示する作品/ });
	for (const control of [heading, search, resultCount, actions, feed]) {
		await expect(control).toBeVisible();
	}
	await expect(
		page
			.getByText("デイリーランキング", { exact: true })
			.filter({ visible: true }),
	).toHaveCount(1);
	const headingBounds = await heading.boundingBox();
	const searchBounds = await search.boundingBox();
	const feedBounds = await feed.boundingBox();
	const actionsBounds = await actions.boundingBox();
	expect(headingBounds?.y).toBeLessThan(searchBounds?.y ?? 0);
	expect(searchBounds?.y).toBeLessThan(feedBounds?.y ?? 0);
	expect(feedBounds?.y).toBe(actionsBounds?.y);
	expect(actionsBounds?.width).toBeGreaterThanOrEqual(44);
	expect(actionsBounds?.height).toBeGreaterThanOrEqual(44);
	await actions.focus();
	await actions.press("ArrowDown");
	await expect(
		page.getByRole("menuitem", { name: "サイトを開く ↗" }),
	).toHaveAttribute("href", "https://www.pixiv.net");
	await expect(
		page.getByRole("menuitem", { name: "pixiv にログイン" }),
	).toBeVisible();
	const recentlyViewed = page.getByRole("menuitem", { name: "最近見た作品" });
	await expect(recentlyViewed).toBeFocused();
	await page.keyboard.press("ArrowDown");
	await expect(page.getByRole("menuitem", { name: "検索履歴" })).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(page.getByRole("dialog", { name: "検索履歴" })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(actions).toBeFocused();
	await actions.press("ArrowUp");
	const site = page.getByRole("menuitem", { name: "サイトを開く ↗" });
	await expect(site).toBeFocused();
	const popupOpened = page.waitForEvent("popup");
	await page.keyboard.press("Enter");
	const popup = await popupOpened;
	await expect(popup).toHaveURL("https://www.pixiv.net/");
	await popup.close();
	await page.getByRole("combobox", { name: "pixiv を検索" }).fill("landscape");
	await page.getByRole("button", { name: "検索", exact: true }).click();
	await expect(
		page.getByText("タグを変更して検索してください。"),
	).toBeVisible();
});

test("switches Pixiv rankings and followed works and removes search badges with one click", async ({
	page,
}, info) => {
	await mockPixivImage(page);
	const inputs: z.infer<typeof viewerRequestSchema>[] = [];
	const code = "C".repeat(22);
	const token = "D".repeat(43);
	await page.route("**/api/rpc/viewer/**", async (route) => {
		const method = route.request().url().split("/").at(-1);
		let result: unknown;
		if (method === "loginPixiv")
			result = { token, userId: "23", expiresAt: Date.now() + 3600000 };
		else if (method === "checkPixivSession") result = { userId: "23" };
		else if (method === "search") {
			const input = viewerRequestSchema.parse(
				route.request().postDataJSON().json,
			);
			inputs.push(input);
			if (input.pixivFeed === "follow")
				expect(route.request().headers().authorization).toBe("Bearer " + token);
			result = {
				provider: "pixiv",
				word: input.tags,
				mappings: [],
				posts: [
					{
						...artwork,
						id: 123 + input.page,
						title: input.tags
							? "タグ検索結果"
							: (input.pixivFeed ?? "daily") + input.page,
					},
				],
				hasNextPage:
					input.pixivFeed === "follow" && !input.tags && input.page === 1,
			};
		} else if (method === "pixivRelatedPage")
			result = { posts: [], nextIds: [] };
		else result = [];
		await route.fulfill({ json: { json: result } });
	});
	const path = info.project.name === "tauri" ? "/#/pixiv" : "/pixiv";
	await page.goto(path);
	const feed = page.getByRole("button", { name: /^表示する作品/ });
	await feed.click();
	await expect(
		page.getByRole("option", { name: "フォロー新着", exact: true }),
	).toHaveAttribute("aria-disabled", "true");
	await page
		.getByRole("option", { name: "ウィークリーランキング", exact: true })
		.click();
	await expect(
		page.getByRole("link", { name: "weekly1 を開く" }),
	).toBeVisible();
	await page.reload();
	await expect(feed).toContainText("ウィークリーランキング");
	await openPixivAction(page, "pixiv にログイン");
	const dialog = page.getByRole("dialog", { name: "pixiv アカウント" });
	await dialog.getByLabel("接続コード").fill(code);
	await dialog.getByRole("button", { name: "接続する", exact: true }).click();
	await feed.click();
	await page.getByRole("option", { name: "フォロー新着", exact: true }).click();
	await expect(
		page.getByRole("link", { name: "follow1 を開く" }),
	).toBeVisible();
	await expect
		.poll(() =>
			inputs.some((input) => input.pixivFeed === "follow" && input.page === 2),
		)
		.toBe(true);
	const input = page.getByRole("combobox", {
		name: "pixiv を検索",
		exact: true,
	});
	await input.fill("風景 -monochrome ~cat");
	await page.getByRole("button", { name: "検索", exact: true }).click();
	await expect(input).toHaveValue("");
	await expect(
		page.getByRole("button", {
			name: "「-monochrome」を検索条件から削除",
			exact: true,
		}),
	).toBeVisible();
	await page
		.getByRole("button", {
			name: "「-monochrome」を検索条件から削除",
			exact: true,
		})
		.click();
	await expect.poll(() => inputs.at(-1)?.tags).toBe("風景 ~cat");
	await page.reload();
	await expect(
		page.getByRole("button", {
			name: "「風景」を検索条件から削除",
			exact: true,
		}),
	).toBeVisible();
	await page
		.getByRole("button", { name: "「風景」を検索条件から削除", exact: true })
		.click();
	await page
		.getByRole("button", { name: "「~cat」を検索条件から削除", exact: true })
		.click();
	await expect.poll(() => inputs.at(-1)?.tags).toBe("");
	await expect(feed).toContainText("フォロー新着");
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBe(true);
});

test("browses private Pixiv bookmarks by tag, opens a work and restores the selection", async ({
	page,
}, info) => {
	await mockPixivImage(page);
	const token = "D".repeat(43);
	const code = "C".repeat(22);
	await page.route("**/api/rpc/viewer/**", async (route) => {
		const method = route.request().url().split("/").at(-1);
		let result: unknown;
		switch (method) {
			case "loginPixiv":
				result = { token, userId: "23", expiresAt: Date.now() + 3600000 };
				break;
			case "checkPixivSession":
				result = { userId: "23" };
				break;
			case "logoutPixiv":
				result = null;
				break;
			case "pixivBookmarkTags": {
				expect(route.request().headers().authorization).toBe("Bearer " + token);
				const { visibility } = route.request().postDataJSON().json;
				result = visibility === "private" ? ["夜 景"] : ["公開タグ"];
				break;
			}
			case "pixivBookmarks": {
				expect(route.request().headers().authorization).toBe("Bearer " + token);
				const {
					visibility,
					tag,
					page: number,
				} = route.request().postDataJSON().json;
				result = {
					provider: "pixiv",
					word: "",
					mappings: [],
					posts: [
						{
							...artwork,
							id: artwork.id + number - 1,
							title:
								visibility === "public"
									? "公開保存"
									: tag
										? "夜の保存" + number
										: "非公開保存",
						},
					],
					hasNextPage: tag === "夜 景" && number === 1,
				};
				break;
			}
			case "pixivArtwork":
				result = artwork;
				break;
			case "pixivBookmarkState":
				result = { visibility: "private", canAdd: true };
				break;
			case "pixivRelatedPage":
				result = { posts: [], nextIds: [] };
				break;
			default:
				result = {
					provider: "pixiv",
					word: "",
					mappings: [],
					posts: [artwork],
					hasNextPage: false,
				};
		}
		await route.fulfill({ json: { json: result } });
	});
	await page.goto(info.project.name === "tauri" ? "/#/pixiv" : "/pixiv");
	const feed = page.getByRole("button", { name: /^表示する作品/ });
	const bookmarks = page.getByRole("option", {
		name: "ブックマーク",
		exact: true,
	});
	await feed.click();
	await expect(bookmarks).toHaveAttribute("aria-disabled", "true");
	await page.keyboard.press("Escape");
	await openPixivAction(page, "pixiv にログイン");
	const account = page.getByRole("dialog", { name: "pixiv アカウント" });
	await account.getByLabel("接続コード").fill(code);
	await account.getByRole("button", { name: "接続する" }).click();
	await feed.click();
	await bookmarks.click();
	await expect(
		page.getByRole("link", { name: "公開保存 を開く" }),
	).toBeVisible();
	await page.getByText("非公開", { exact: true }).click();
	await expect(
		page.getByRole("link", { name: "非公開保存 を開く" }),
	).toBeVisible();
	const tag = page.getByRole("button", { name: /^ブックマークタグ/ });
	await expect(
		page
			.getByRole("status")
			.filter({ hasText: "ブックマークタグを読み込み中" }),
	).toBeHidden();
	await tag.click();
	await page.getByRole("option", { name: "夜 景", exact: true }).click();
	const first = page.getByRole("link", { name: "夜の保存1 を開く" });
	await expect(first).toBeVisible();
	const second = page.getByRole("link", { name: "夜の保存2 を開く" });
	await expect(second).toBeVisible();
	await first.click();
	await expect(
		page.getByRole("heading", { name: artwork.title, exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "一覧に戻る" }).click();
	await expect(first).toBeVisible();
	await page.reload();
	await expect(tag).toContainText("夜 景");
	await expect(first).toBeVisible();
	await openPixivAction(page, "pixiv ID 23");
	await account
		.getByRole("button", { name: "この ビューアー からログアウト" })
		.click();
	await expect(feed).toContainText("デイリーランキング");
	await expect(first).toHaveCount(0);
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBe(true);
});

test("adds and removes a Pixiv bookmark from the artwork and refreshes the list", async ({
	page,
}, info) => {
	await mockPixivImage(page);
	const code = "C".repeat(22);
	const token = "D".repeat(43);
	let visibility: PixivBookmarkChange["visibility"] = null;
	const changes: PixivBookmarkChange["visibility"][] = [];
	await page.route("**/api/rpc/viewer/**", (route) => {
		const method = route.request().url().split("/").at(-1);
		let result: unknown;
		switch (method) {
			case "loginPixiv":
				result = { token, userId: "23", expiresAt: Date.now() + 3600000 };
				break;
			case "checkPixivSession":
				result = { userId: "23" };
				break;
			case "setPixivBookmark": {
				expect(route.request().headers().authorization).toBe("Bearer " + token);
				const input = pixivBookmarkChangeSchema.parse(
					route.request().postDataJSON().json,
				);
				expect(input.id).toBe(artwork.id);
				visibility = input.visibility;
				changes.push(visibility);
				result = { visibility, canAdd: true };
				break;
			}
			case "pixivBookmarkState":
				expect(route.request().headers().authorization).toBe("Bearer " + token);
				result = { visibility, canAdd: true };
				break;
			case "pixivArtwork":
				result = artwork;
				break;
			case "pixivRelatedPage":
				result = { posts: [], nextIds: [] };
				break;
			case "pixivBookmarkTags":
				result = [];
				break;
			default:
				result = {
					provider: "pixiv",
					word: "",
					mappings: [],
					posts:
						method === "pixivBookmarks" &&
						visibility !== route.request().postDataJSON().json.visibility
							? []
							: [artwork],
					hasNextPage: false,
				};
		}
		return route.fulfill({ json: { json: result } });
	});
	const path = info.project.name === "tauri" ? "/#/pixiv" : "/pixiv";
	const artworkLink = page.getByRole("link", { name: "海の風景 を開く" });
	await page.goto(path);
	await artworkLink.click();
	const open = page.getByRole("button", { name: "ブックマーク", exact: true });
	await expect(open).toHaveCount(0);
	await page.getByRole("button", { name: "一覧に戻る" }).click();
	await openPixivAction(page, "pixiv にログイン");
	const account = page.getByRole("dialog", { name: "pixiv アカウント" });
	await account.getByLabel("接続コード").fill(code);
	await account.getByRole("button", { name: "接続する" }).click();
	await artworkLink.click();
	await open.click();
	const dialog = page.getByRole("dialog", {
		name: "ブックマーク",
		exact: true,
	});
	await expect(
		dialog.getByRole("radio", { name: "非公開", exact: true }),
	).toBeChecked();
	await dialog.getByText("公開", { exact: true }).click();
	await dialog.getByRole("button", { name: "ブックマークに追加" }).click();
	const saved = page.getByRole("button", { name: "ブックマーク済み（公開）" });
	await expect(saved).toBeVisible();
	await page.reload();
	await expect(saved).toBeVisible();
	await page.getByRole("button", { name: "一覧に戻る" }).click();
	await page.getByRole("button", { name: /^表示する作品/ }).click();
	await page.getByRole("option", { name: "ブックマーク", exact: true }).click();
	await artworkLink.click();
	await saved.click();
	const remove = page.getByRole("dialog", { name: "ブックマーク済み（公開）" });
	await expect(
		remove.getByRole("button", { name: "キャンセル" }),
	).toBeFocused();
	await remove.getByRole("button", { name: "キャンセル" }).click();
	await expect(saved).toBeFocused();
	await saved.click();
	await remove.getByRole("button", { name: "ブックマークを解除" }).click();
	await expect(open).toBeVisible();
	await page.getByRole("button", { name: "一覧に戻る" }).click();
	await expect(page.getByText("該当する作品がありません")).toBeVisible();
	await expect(artworkLink).toHaveCount(0);
	expect(changes).toEqual(["public", null]);
});

test("restores expanded related works and scroll position on Back and Forward", async ({
	page,
}, info) => {
	await mockPixivDetail(page, artwork);
	await page.route("**/api/rpc/viewer/pixivArtwork", (route) =>
		route.fulfill({
			json: {
				json: { ...artwork, id: route.request().postDataJSON().json.id },
			},
		}),
	);
	let calls = 0;
	const card = (id: number) => ({ ...artwork, id, title: "関連" + id });
	await page.route("**/api/rpc/viewer/pixivRelatedPage", (route) => {
		calls++;
		const { id, ids } = route.request().postDataJSON().json;
		return route.fulfill({
			json: {
				json: {
					posts:
						id !== 123
							? []
							: (ids ?? Array.from({ length: 18 }, (_, i) => 500 + i)).map(
									card,
								),
					nextIds:
						id === 123 && !ids
							? Array.from({ length: 19 }, (_, i) => 600 + i)
							: [],
				},
			},
		});
	});
	await page.goto(
		info.project.name === "tauri" ? "/#/pixiv/123" : "/pixiv/123",
	);
	const related = page.getByRole("region", { name: "関連作品", exact: true });
	await related
		.getByRole("button", { name: "もっと見る", exact: true })
		.click();
	await expect(related.getByText("36件を表示", { exact: true })).toHaveCount(1);
	const link = related.getByRole("link", { name: "関連617 を開く" });
	await link.scrollIntoViewIfNeeded();
	const beforeReload = calls;
	await related.evaluate((el) => {
		window.addEventListener(
			"pagehide",
			() => {
				let area = el.parentElement;
				while (area && !/(auto|scroll)/.test(getComputedStyle(area).overflowY))
					area = area.parentElement;
				sessionStorage.setItem(
					"test:reload-scroll",
					String(area?.scrollTop ?? 0),
				);
			},
			{ once: true },
		);
	});
	await page.reload();
	await expect(related.getByText("36件を表示", { exact: true })).toHaveCount(1);
	const reloadPosition = await page.evaluate(() =>
		Number(sessionStorage.getItem("test:reload-scroll")),
	);
	expect(reloadPosition).toBeGreaterThan(100);
	await expect
		.poll(async () =>
			related.evaluate((el) => {
				let area = el.parentElement;
				while (area && !/(auto|scroll)/.test(getComputedStyle(area).overflowY))
					area = area.parentElement;
				return area?.scrollTop ?? 0;
			}),
		)
		.toBeCloseTo(reloadPosition, 0);
	expect(calls).toBe(beforeReload);
	await link.evaluate((el) =>
		el.addEventListener(
			"click",
			() => {
				let area = el.parentElement;
				while (area && !/(auto|scroll)/.test(getComputedStyle(area).overflowY))
					area = area.parentElement;
				document.documentElement.dataset.departureScroll = String(
					area?.scrollTop ?? 0,
				);
			},
			{ capture: true, once: true },
		),
	);
	await link.click();
	const position = await page.evaluate(() =>
		Number(document.documentElement.dataset.departureScroll),
	);
	expect(position).toBeGreaterThan(100);
	await expect(page).toHaveURL(/\/pixiv\/617$/);
	await expect(related.getByText("関連作品はありません")).toBeVisible();
	const before = calls;
	await page.goBack();
	await expect(page).toHaveURL(/\/pixiv\/123$/);
	await expect(related.getByText("36件を表示", { exact: true })).toHaveCount(1);
	await expect
		.poll(async () => {
			const restored = await related.evaluate((el) => {
				let area = el.parentElement;
				while (area && !/(auto|scroll)/.test(getComputedStyle(area).overflowY))
					area = area.parentElement;
				return area?.scrollTop ?? 0;
			});
			return Math.abs(restored - position);
		})
		.toBeLessThan(3);
	expect(calls).toBe(before);
	await page.goForward();
	await expect(page).toHaveURL(/\/pixiv\/617$/);
	await page.goBack();
	await expect(related.getByText("36件を表示", { exact: true })).toHaveCount(1);
	await related
		.getByRole("button", { name: "もっと見る", exact: true })
		.click();
	await expect(related.getByText("37件を表示", { exact: true })).toHaveCount(1);
});

test("shows Pixiv related works offline before the first load and retains cached cards", async ({
	page,
}, info) => {
	await mockPixivDetail(page, artwork);
	await page.route("**/api/rpc/viewer/pixivArtwork", async (route) => {
		// Deliver the detail already in flight while the next query sees the disconnect.
		await page.evaluate(() => window.dispatchEvent(new Event("offline")));
		await route.fulfill({ json: { json: artwork } });
	});
	const relatedCard = { ...artwork, id: 456, title: "保存済みの関連作品" };
	let relatedRequests = 0;
	await page.route("**/api/rpc/viewer/pixivRelatedPage", (route) => {
		relatedRequests += 1;
		return route.fulfill({
			json: { json: { posts: [relatedCard], nextIds: [457] } },
		});
	});
	await page.goto(info.project.name === "tauri" ? "/#/pixiv" : "/pixiv");
	await page.getByRole("link", { name: "海の風景 を開く" }).click();
	const related = page.getByRole("region", { name: "関連作品", exact: true });
	await expect(
		related.getByRole("heading", { name: "オフラインです" }),
	).toBeVisible();
	await expect(related.locator('[data-state-ui="pending"]')).toHaveCount(0);
	await expect(
		related.getByRole("button", { name: "再試行", exact: true }),
	).toBeVisible();
	expect(relatedRequests).toBe(0);

	await page.evaluate(() => window.dispatchEvent(new Event("online")));
	const card = related.getByRole("link", { name: "保存済みの関連作品 を開く" });
	const more = related.getByRole("button", { name: "もっと見る", exact: true });
	await expect(card).toBeVisible();

	await page.evaluate(() => window.dispatchEvent(new Event("offline")));
	const cachedStatus = related.locator('[data-state-ui="cached-offline"]');
	await expect(cachedStatus).toBeVisible();
	await expect(card).toBeVisible();
	await expect(more).toBeDisabled();

	await page.evaluate(() => window.dispatchEvent(new Event("online")));
	await expect(cachedStatus).toHaveCount(0);
	await expect(more).toBeEnabled();
});

test("loads more related works in batches and retries the same cursor", async ({
	page,
	browserHealth,
}, info) => {
	await mockPixivDetail(page, artwork);
	browserHealth.allowResponseFailure("/api/rpc/viewer/pixivRelatedPage");
	browserHealth.allowConsole(
		"Failed to load resource: the server responded with a status of 503",
	);
	const card = (id: number) => ({ ...artwork, id, title: "関連" + id });
	const first = Array.from({ length: 18 }, (_, i) => 500 + i);
	const next = Array.from({ length: 19 }, (_, i) => 600 + i);
	let fail = true;
	let releaseFailure: () => void = () => {};
	const holdFailure = new Promise<void>((resolve) => {
		releaseFailure = resolve;
	});
	const batches: number[][] = [];
	await page.route("**/api/rpc/viewer/pixivRelatedPage", async (route) => {
		const ids: number[] | undefined = route.request().postDataJSON().json.ids;
		if (!ids) {
			await route.fulfill({
				json: {
					json: { posts: first.map(card), nextIds: [123, 500, ...next, 600] },
				},
			});
			return;
		}
		batches.push(ids);
		if (fail) {
			fail = false;
			await holdFailure;
			await route.fulfill({
				status: 503,
				json: { json: { code: "SERVICE_UNAVAILABLE", message: "unavailable" } },
			});
			return;
		}
		await route.fulfill({
			json: { json: { posts: [card(500), ...ids.map(card)], nextIds: [] } },
		});
	});
	const path = (s: string) => (info.project.name === "tauri" ? "/#" + s : s);
	await page.goto(path("/pixiv/123"));
	const related = page.getByRole("region", { name: "関連作品", exact: true });
	const more = related.getByRole("button", { name: "もっと見る", exact: true });
	await more.click();
	try {
		await expect(
			related.locator('[data-state-ui="background-fetching"]'),
		).toHaveText("関連作品を更新中");
		await expect(related.getByText("18件を表示", { exact: true })).toHaveCount(
			1,
		);
	} finally {
		releaseFailure();
	}
	await expect(related.getByRole("alert")).toHaveText(
		"関連作品を取得できませんでした",
	);
	await related.getByRole("button", { name: "再試行", exact: true }).click();
	await expect(related.getByText("36件を表示", { exact: true })).toHaveCount(1);
	await more.click();
	await expect(related.getByText("37件を表示", { exact: true })).toHaveCount(1);
	await expect(more).toHaveCount(0);
	expect(batches).toEqual([
		next.slice(0, 18),
		next.slice(0, 18),
		next.slice(18),
	]);
	await page.reload();
	await expect(related.getByText("37件を表示", { exact: true })).toHaveCount(1);
	await expect(more).toHaveCount(0);
});

test("opens related Pixiv works, reloads, retries recommendations and returns to the collection", async ({
	page,
	browserHealth,
}, info) => {
	await mockPixivDetail(page, artwork);
	await page.route("**/api/rpc/viewer/pixivArtwork", (route) => {
		const id = route.request().postDataJSON().json.id;
		return route.fulfill({
			json: {
				json: {
					...artwork,
					id,
					title: id === 123 ? artwork.title : "関連作品の詳細",
				},
			},
		});
	});
	let fail = true;
	browserHealth.allowResponseFailure("/api/rpc/viewer/pixivRelatedPage");
	browserHealth.allowConsole(
		"Failed to load resource: the server responded with a status of 503 (Service Unavailable)",
	);
	await page.route("**/api/rpc/viewer/pixivRelatedPage", async (route) => {
		const id = route.request().postDataJSON().json.id;
		if (fail) {
			fail = false;
			await route.fulfill({
				status: 503,
				json: { json: { code: "SERVICE_UNAVAILABLE", message: "unavailable" } },
			});
			return;
		}
		await route.fulfill({
			json: {
				json: {
					posts:
						id === 123 ? [{ ...artwork, id: 456, title: "関連の風景" }] : [],
					nextIds: [],
				},
			},
		});
	});
	const path = (value: string) =>
		info.project.name === "tauri" ? "/#" + value : value;
	await page.goto(path("/about"));
	await navigateTo(page, "pixiv");
	await page.getByRole("link", { name: "海の風景 を開く" }).click();
	const related = page.getByRole("region", { name: "関連作品", exact: true });
	await expect(
		page.getByRole("img", { name: artwork.title, exact: true }),
	).toBeVisible();
	await related.getByRole("button", { name: "再試行", exact: true }).click();
	await related.getByRole("link", { name: "関連の風景 を開く" }).press("Enter");
	await expect(page).toHaveURL(/\/pixiv\/456$/);
	await expect(
		page.getByRole("heading", { name: "関連作品の詳細", exact: true }),
	).toBeVisible();
	await expect(related.getByText("関連作品はありません")).toBeVisible();
	await page.goBack();
	await expect(page).toHaveURL(/\/pixiv\/123$/);
	await page.getByRole("button", { name: "一覧に戻る", exact: true }).click();
	await expect(page).toHaveURL(/\/pixiv$/);
	await page.goBack();
	await expect(page).toHaveURL(/\/about$/);
	await page.goForward();
	await expect(page).toHaveURL(/\/pixiv$/);
	await page.getByRole("link", { name: "海の風景 を開く" }).click();
	await related.getByRole("link", { name: "関連の風景 を開く" }).click();
	await page.reload();
	await expect(
		page.getByRole("heading", { name: "関連作品の詳細", exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "一覧に戻る", exact: true }).click();
	await expect(page).toHaveURL(/\/pixiv$/);
	await expect(
		page.getByRole("link", { name: "海の風景 を開く" }),
	).toBeVisible();
});

test("opens the author's works inside Pixiv and restores them after reload", async ({
	page,
}, info) => {
	await mockPixivDetail(page, artwork);
	await page.route("**/api/rpc/viewer/search", (route) => {
		const input = viewerRequestSchema.parse(
			route.request().postDataJSON().json,
		);
		return route.fulfill({
			json: {
				json: {
					provider: "pixiv",
					word: "",
					mappings: [],
					posts:
						input.pixivUserId === "23"
							? [{ ...artwork, title: "作者の別作品" }]
							: [artwork],
					hasNextPage: false,
				},
			},
		});
	});
	const path = (s: string) => (info.project.name === "tauri" ? "/#" + s : s);
	await page.goto(path("/pixiv"));
	await page.getByRole("link", { name: "海の風景 を開く" }).click();
	await page
		.getByRole("button", { name: "作者名", exact: true })
		.press("Enter");
	await expect(page).toHaveURL(/\/pixiv$/);
	await expect(page.getByText("作者名の作品", { exact: true })).toBeVisible();
	await expect(
		page.getByRole("link", { name: "作者の別作品 を開く" }),
	).toBeVisible();
	await page.reload();
	await expect(
		page.getByRole("link", { name: "作者の別作品 を開く" }),
	).toBeVisible();
	await page.getByRole("link", { name: "作者の別作品 を開く" }).click();
	await page.getByRole("button", { name: "一覧に戻る", exact: true }).click();
	await expect(page.getByText("作者名の作品", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "作者の絞り込みを解除" }).click();
	await expect(
		page.getByRole("link", { name: "海の風景 を開く" }),
	).toBeVisible();
	await page.goto(path("/pixiv/123"));
	await page.reload();
	await page.getByRole("button", { name: "作者名", exact: true }).click();
	await expect(
		page.getByRole("link", { name: "作者の別作品 を開く" }),
	).toBeVisible();
});

test("loads the Pixiv preview until original quality is requested", async ({
	page,
}, info) => {
	const pages = artwork.pages.map((p, i) => ({
		...p,
		preview: p.preview.replace("img-original", "img-master"),
		original: i === 0 ? p.original : null,
	}));
	const originals: string[] = [];
	await mockPixivDetail(page, {
		...artwork,
		thumbnail: pages[0].preview,
		pages,
	});
	page.on("request", (request) => {
		const url = new URL(request.url());
		if (
			url.pathname === "/api/pixiv-image" &&
			url.searchParams.get("url")?.includes("/img-original/")
		)
			originals.push(request.url());
	});
	await page.goto(
		info.project.name === "tauri" ? "/#/pixiv/123" : "/pixiv/123",
	);
	const img = page.getByRole("img", { name: artwork.title, exact: true });
	const toggle = page.getByRole("button", { name: "原寸画像を表示" });
	await expect(img).toHaveAttribute("src", /img-master.*123_p0/);
	expect(originals).toHaveLength(0);
	await toggle.press("Enter");
	await expect(toggle).toHaveAttribute("aria-pressed", "true");
	await expect(img).toHaveAttribute("src", /img-original.*123_p0/);
	await expect.poll(() => originals.length).toBeGreaterThan(0);
	await toggle.click();
	await expect(img).toHaveAttribute("src", /img-master.*123_p0/);
	await toggle.click();
	await page.getByRole("button", { name: "次の画像", exact: true }).click();
	await expect(img).toHaveAttribute("src", /img-master.*123_p1/);
	await expect(toggle).toHaveCount(0);
	await page.getByRole("button", { name: "前の画像", exact: true }).click();
	await expect(img).toHaveAttribute("src", /img-master.*123_p0/);
	await expect(toggle).toHaveAttribute("aria-pressed", "false");
});

test("searches for the exact artwork tag from Pixiv detail", async ({
	page,
}, info) => {
	const tag = "Re:ゼロ";
	await mockPixivDetail(page, { ...artwork, tags: [tag] });
	await page.route("**/api/rpc/viewer/search", (route) => {
		const input = viewerRequestSchema.parse(
			route.request().postDataJSON().json,
		);
		const posts =
			input.literalPixivTag && input.tags === tag && input.page === 1
				? [{ ...artwork, title: "タグの検索結果" }]
				: [];
		return route.fulfill({
			json: {
				json: {
					provider: "pixiv",
					word: input.tags,
					mappings: [],
					posts,
					hasNextPage: false,
				},
			},
		});
	});
	await page.goto(
		info.project.name === "tauri" ? "/#/pixiv/123" : "/pixiv/123",
	);
	await page
		.getByRole("button", { name: `「${tag}」で検索`, exact: true })
		.press("Enter");
	await expect(page).toHaveURL(/\/pixiv$/);
	await expect(
		page.getByRole("combobox", { name: "pixiv を検索" }),
	).toHaveValue("");
	await expect(
		page.getByRole("button", { name: "「" + tag + "」を検索条件から削除" }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "タグの検索結果 を開く" }),
	).toBeVisible();
	await page.reload();
	await expect(
		page.getByRole("link", { name: "タグの検索結果 を開く" }),
	).toBeVisible();
});

for (const action of ["author", "tag"] as const) {
	test(`starts a new Pixiv ${action} collection at the top from artwork detail`, async ({
		page,
	}, info) => {
		await mockPixivDetail(page, artwork);
		const posts = [
			...Array.from({ length: 40 }, (_, index) => ({
				...artwork,
				id: 1000 + index,
				title: "検索結果 " + index,
			})),
			artwork,
		];
		await page.route("**/api/rpc/viewer/search", (route) => {
			const input = viewerRequestSchema.parse(
				route.request().postDataJSON().json,
			);
			const filtered = !!(input.pixivUserId || input.literalPixivTag);
			return route.fulfill({
				json: {
					json: {
						provider: "pixiv",
						word: input.tags,
						mappings: [],
						posts: filtered ? posts : [artwork],
						hasNextPage: false,
					},
				},
			});
		});
		await page.goto(info.project.name === "tauri" ? "/#/pixiv" : "/pixiv");
		await page.getByRole("link", { name: "海の風景 を開く" }).click();
		await page
			.getByRole("button", {
				name:
					action === "author" ? artwork.author : `「${artwork.tags[0]}」で検索`,
				exact: true,
			})
			.click();
		const scroller = page.locator('[data-media-scroll="pixiv"]');
		await expect(
			scroller.getByRole("link", { name: "検索結果 0 を開く" }),
		).toBeInViewport();
		await expect(
			page.getByRole("heading", { name: "pixiv", exact: true }),
		).toBeFocused();
		await expect
			.poll(() => scroller.evaluate((element) => element.scrollTop))
			.toBe(0);
	});
}

test("reapplies Pixiv search history with operators and exact tags after reload", async ({
	page,
}, info) => {
	await mockPixivDetail(page, { ...artwork, tags: ["Re:ゼロ"] });
	const searches: z.infer<typeof viewerRequestSchema>[] = [];
	await page.route("**/api/rpc/viewer/search", (route) => {
		const input = viewerRequestSchema.parse(
			route.request().postDataJSON().json,
		);
		searches.push(input);
		return route.fulfill({
			json: {
				json: {
					provider: "pixiv",
					posts: [artwork],
					hasNextPage: false,
					word: input.tags,
					mappings:
						input.tags.startsWith("landscape") && !input.literalPixivTag
							? [
									{
										tag: "landscape",
										names: ["風景", "景色"],
										selected: input.choices?.landscape ?? "風景",
										source: "wiki",
									},
								]
							: [],
				},
			},
		});
	});
	await page.route("**/api/rpc/viewer/suggestTags", (route) =>
		route.fulfill({ json: { json: [] } }),
	);
	await page.goto(info.project.name === "tauri" ? "/#/pixiv" : "/pixiv");
	const open = () => openPixivAction(page, "検索履歴");
	const dialog = page.getByRole("dialog", { name: "検索履歴", exact: true });
	const empty = dialog.getByText("検索履歴はありません", { exact: true });
	await open();
	await expect(empty).toBeVisible();
	await page.keyboard.press("Escape");

	const input = page.getByRole("combobox", { name: "pixiv を検索" });
	await input.fill("landscape -monochrome ~cat");
	await page.getByRole("button", { name: "検索", exact: true }).click();
	await expect
		.poll(() => searches.at(-1)?.tags)
		.toBe("landscape -monochrome ~cat");
	await page.getByRole("button", { name: /^landscape/ }).click();
	await page.getByRole("option", { name: "景色", exact: true }).click();
	await expect
		.poll(() => searches.at(-1)?.choices)
		.toEqual({ landscape: "景色" });
	await page.getByRole("link", { name: "海の風景 を開く" }).click();
	await page
		.getByRole("button", { name: "「Re:ゼロ」で検索", exact: true })
		.click();
	await expect.poll(() => searches.at(-1)?.literalPixivTag).toBe(true);

	await page.reload();
	await open();
	const entries = dialog.getByRole("listitem");
	await expect(entries).toHaveText([
		/Re:ゼロ/,
		/landscape -monochrome ~cat.*景色/,
		/landscape -monochrome ~cat/,
	]);
	const before = searches.length;
	await dialog
		.getByRole("button", { name: /landscape -monochrome ~cat.*景色/ })
		.click();
	await expect(dialog).toBeHidden();
	await expect.poll(() => searches.length).toBeGreaterThan(before);
	expect(searches.at(-1)).toMatchObject({
		tags: "landscape -monochrome ~cat",
		choices: { landscape: "景色" },
		page: 1,
	});
	await expect(
		page.getByRole("button", { name: "「-monochrome」を検索条件から削除" }),
	).toBeVisible();
	await open();
	await expect(entries.first()).toContainText("景色");
	await expect(entries).toHaveCount(3);
	await dialog.getByRole("button", { name: /^Re:ゼロ/ }).click();
	await expect
		.poll(() => searches.at(-1))
		.toMatchObject({ tags: "Re:ゼロ", literalPixivTag: true });
	await open();
	await dialog.getByRole("button", { name: "履歴を消去" }).click();
	const confirmation = page.getByRole("alertdialog", {
		name: "検索履歴を消去しますか？",
	});
	await expect(
		confirmation.getByRole("button", { name: "キャンセル" }),
	).toBeFocused();
	await confirmation.getByRole("button", { name: "履歴を消去" }).click();
	await expect(empty).toBeVisible();
	await page.reload();
	await open();
	await expect(empty).toBeVisible();
});

test("reopens recent Pixiv works in order and clears the saved viewing history", async ({
	page,
}, info) => {
	const related = { ...artwork, id: 456, title: "森の風景" };
	await mockPixivDetail(page, artwork);
	await page.route("**/api/rpc/viewer/pixivArtwork", (route) => {
		const id = route.request().postDataJSON().json.id;
		return route.fulfill({
			json: { json: id === related.id ? related : artwork },
		});
	});
	await page.route("**/api/rpc/viewer/pixivRelatedPage", (route) => {
		const id = route.request().postDataJSON().json.id;
		return route.fulfill({
			json: {
				json: { posts: id === artwork.id ? [related] : [], nextIds: [] },
			},
		});
	});
	const path = info.project.name === "tauri" ? "/#/pixiv" : "/pixiv";
	await page.goto(path);
	const open = () => openPixivAction(page, "最近見た作品");
	const history = page.getByRole("dialog", {
		name: "最近見た作品",
		exact: true,
	});
	const empty = history.getByText("閲覧履歴はありません", { exact: true });
	const close = () =>
		history.getByRole("button", { name: "閉じる", exact: true }).click();
	await open();
	await expect(empty).toBeVisible();
	await close();
	await expect(pixivActions(page)).toBeFocused();

	await page.getByRole("link", { name: "海の風景 を開く" }).click();
	await page.getByRole("link", { name: "森の風景 を開く" }).click();
	await expect(
		page.getByRole("heading", { name: "森の風景", exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "最近見た作品", exact: true }).click();
	await expect(history.getByRole("link")).toHaveText([/森の風景/, /海の風景/]);
	await history.getByRole("link", { name: "海の風景 を開く" }).click();
	await expect(history).toBeHidden();
	await expect(
		page.getByRole("heading", { name: "海の風景", exact: true }),
	).toBeVisible();

	await page.goto(path);
	await open();
	await expect(history.getByRole("link")).toHaveText([/海の風景/, /森の風景/]);
	const clear = history.getByRole("button", { name: "履歴を消去" });
	const confirm = page.getByRole("alertdialog", {
		name: "閲覧履歴を消去しますか？",
	});
	await clear.click();
	const cancel = confirm.getByRole("button", { name: "キャンセル" });
	await expect(cancel).toBeFocused();
	await cancel.click();
	await expect(history.getByRole("link")).toHaveCount(2);
	await clear.click();
	await confirm.getByRole("button", { name: "履歴を消去" }).click();
	await expect(empty).toBeVisible();
	await page.reload();
	await open();
	await expect(empty).toBeVisible();
});

test("reads Pixiv pages vertically, jumps by thumbnail and resumes after reload", async ({
	page,
}, info) => {
	const work = pixivArtworkSchema.parse({
		...artwork,
		pageCount: 7,
		pages: Array.from({ length: 7 }, (_, index) => ({
			preview: (base + index + ".png").replace("img-original", "img-master"),
			original: base + index + ".png",
			width: 640,
			height: 900,
		})),
	});
	await mockPixivDetail(page, work);
	await page.goto(info.project.name === "tauri" ? "/#/pixiv" : "/pixiv");
	await page.getByRole("link", { name: "海の風景 を開く" }).click();

	const open = page.getByRole("button", { name: "縦読み", exact: true });
	const dialog = page.getByRole("dialog", { name: work.title });
	const reader = dialog.getByRole("region", { name: "縦読み", exact: true });
	const thumbnail = (number: number) =>
		dialog.getByRole("button", { name: number + "ページ目", exact: true });
	const image = (number: number) =>
		reader.getByRole("img", { name: number + "ページ目", exact: true });

	await open.click();
	await expect(image(1)).toBeInViewport();
	await expect(reader.getByRole("img")).toHaveCount(7);
	await expect(image(1)).toHaveAttribute("src", /img-master/);
	await expect(image(7)).toHaveAttribute("loading", "lazy");
	await expect(thumbnail(1)).toHaveAttribute("aria-current", "page");
	await expect(reader).toBeFocused();
	await image(3).evaluate((element) =>
		element.scrollIntoView({ block: "start" }),
	);
	await expect(thumbnail(3)).toHaveAttribute("aria-current", "page");

	await thumbnail(7).click();
	await expect(image(7)).toBeInViewport();
	await expect(thumbnail(7)).toHaveAttribute("aria-current", "page");
	await page.keyboard.press("Escape");
	await expect(dialog).toBeHidden();
	await expect(open).toBeFocused();
	await expect(page.getByRole("button", { name: "次の画像" })).toBeDisabled();

	await page.reload();
	await expect(page.getByRole("button", { name: "次の画像" })).toBeDisabled();
	await open.click();
	await expect(image(7)).toBeInViewport();
	await expect(thumbnail(7)).toHaveAttribute("aria-current", "page");
	await thumbnail(1).click();
	await expect(image(1)).toBeInViewport();
	await expect(thumbnail(1)).toHaveAttribute("aria-current", "page");
});

test("queues selected pixiv pages then all remaining originals in the import inbox", async ({
	page,
	browserHealth,
}, info) => {
	const id = 124;
	const prefix = base.replace("123_p", id + "_p");
	const original = (index: number) => prefix + index + ".png";
	const work = pixivArtworkSchema.parse({
		...artwork,
		id,
		pageCount: 5,
		pages: Array.from({ length: 5 }, (_, index) => ({
			...artwork.pages[0],
			preview: original(index).replace("img-original", "img-master"),
			original: index === 3 ? null : original(index),
		})),
	});
	await mockPixivDetail(page, work);
	const path = "/pixiv/" + id;
	await page.goto(info.project.name === "tauri" ? "/#" + path : path);
	const detail = page.getByRole("region", { name: "pixiv #" + id });
	await detail.getByRole("button", { name: "ページを選ぶ" }).click();
	const checkbox = (number: number) =>
		detail.getByRole("checkbox", { name: number + "ページ目", exact: true });
	await expect(checkbox(4)).toBeDisabled();
	const addSelected = detail.getByRole("button", {
		name: /選択した.*ページを取り込み待ちへ/,
	});
	await expect(addSelected).toBeDisabled();
	await checkbox(3).press("Space");
	await checkbox(1).press("Space");
	await expect(checkbox(1)).toBeChecked();
	await expect(checkbox(3)).toBeChecked();

	const submit = async (button: Locator, indices: number[]) => {
		const [response] = await Promise.all([
			page.waitForResponse("**/api/rpc/imports/bulkAdd"),
			button.click(),
		]);
		expect(response.ok()).toBe(true);
		expect(response.request().postDataJSON().json.items).toMatchObject(
			indices.map((index) => ({ targetUrl: original(index) })),
		);
	};
	const workUrl = "https://www.pixiv.net/artworks/" + id;
	const workJobs = async () =>
		(await pendingImports(page)).filter((job) =>
			job.item.sourceUrls?.includes(workUrl),
		);
	try {
		await submit(addSelected, [0, 2]);
		await expect(
			detail.getByRole("button", {
				name: "取り込み待ちに追加済み",
				exact: true,
			}),
		).toBeDisabled();
		await submit(
			detail.getByRole("button", { name: "全ページを取り込み待ちへ" }),
			[1, 4],
		);
		expect(browserHealth.apiRequestCount("/api/rpc/imports/bulkAdd")).toBe(2);
		const jobs = await workJobs();
		expect(jobs).toHaveLength(4);
		expect(jobs.map((job) => job.item.targetUrl)).toEqual(
			expect.arrayContaining([0, 1, 2, 4].map(original)),
		);
		for (const { item } of jobs) {
			expect(item.sourceUrls).toEqual([item.targetUrl, workUrl]);
		}
	} finally {
		const jobs = await workJobs();
		if (jobs.length > 0) {
			const cancel = await page.request.post("/api/rpc/imports/cancel", {
				data: { json: { jobIds: jobs.map((job) => job.id) } },
			});
			expect(cancel.ok()).toBe(true);
		}
	}
});

test("connects a pixiv account, restores it on reload and removes private results on logout", async ({
	page,
}, info) => {
	const code = "A".repeat(22),
		token = "B".repeat(43);
	let active = false;
	let checkCount = 0;
	let countRestoredChecks = false;
	const restoredCheck = Promise.withResolvers<void>();
	const fixtureSession = "123_fixture";
	if (info.project.name === "tauri") {
		await page.addInitScript(() => {
			Object.defineProperty(window, "isTauri", { value: true });
			window.addEventListener(
				"open_pixiv_login",
				() => (document.documentElement.dataset.pixivLoginOpened = "true"),
			);
		});
	}
	await page.route("**/api/rpc/viewer/**", async (route) => {
		if (route.request().url().endsWith("/pixivRelatedPage")) {
			await route.fulfill({ json: { json: { posts: [], nextIds: [] } } });
			return;
		}
		const rpc = route.request().url().split("/").at(-1);
		const bearer = route.request().headers().authorization;
		let result: unknown;
		if (rpc === "issuePixivCode") {
			expect(route.request().postDataJSON().json.sessionId).toBe(
				fixtureSession,
			);
			result = { code };
		} else if (rpc === "loginPixiv") {
			expect(route.request().postDataJSON().json.code).toBe(code);
			expect(bearer).toBeUndefined();
			active = true;
			result = { token, userId: "123", expiresAt: Date.now() + 3_600_000 };
		} else if (rpc === "logoutPixiv" || rpc === "checkPixivSession") {
			expect(bearer).toBe("Bearer " + token);
			if (rpc === "logoutPixiv") active = false;
			else if (countRestoredChecks && ++checkCount === 1)
				await restoredCheck.promise;
			result = rpc === "logoutPixiv" ? null : { userId: "123" };
		} else if (rpc === "pixivBookmarkState") {
			expect(bearer).toBe("Bearer " + token);
			result = { visibility: null, canAdd: true };
		} else if (rpc === "pixivArtwork") {
			expect(bearer).toBe("Bearer " + token);
			result = { ...artwork, title: "会員作品", thumbnail: null };
		} else {
			const authenticated = active && bearer === "Bearer " + token;
			result = {
				provider: "pixiv",
				posts: [
					{
						id: 123,
						title: authenticated ? "会員作品" : "公開作品",
						author: "作者",
						thumbnail: null,
						pageCount: 1,
					},
				],
				hasNextPage: false,
				word: "",
				mappings: [],
			};
		}
		await route.fulfill({ json: { json: result } });
	});
	await page.goto(info.project.name === "tauri" ? "/#/pixiv" : "/pixiv");
	await expect(
		page.getByRole("link", { name: "公開作品 を開く" }),
	).toBeVisible();
	await openPixivAction(page, "pixiv にログイン");
	const dialog = page.getByRole("dialog", { name: "pixiv アカウント" });
	if (info.project.name === "tauri") {
		await dialog
			.getByRole("button", { name: "公式 pixiv でログイン ↗" })
			.click();
		await expect(page.locator("html")).toHaveAttribute(
			"data-pixiv-login-opened",
			"true",
		);
	} else {
		await expect(
			dialog.getByRole("link", { name: "公式 pixiv でログイン ↗" }),
		).toHaveAttribute("href", "https://accounts.pixiv.net/login");
	}
	await dialog.getByLabel("接続コード").fill("bad");
	await dialog.getByRole("button", { name: "接続する" }).click();
	await expect(dialog.getByRole("alert")).toContainText("接続コード");
	await dialog.getByLabel("接続コード").fill(code);
	await dialog.getByRole("button", { name: "接続する" }).click();
	await expect(
		page.getByRole("link", { name: "会員作品 を開く" }),
	).toBeVisible();
	await mockPixivImage(page);
	await page.getByRole("link", { name: "会員作品 を開く" }).click();
	const viewingHistory = page.getByRole("dialog", { name: "最近見た作品" });
	const openHistory = page.getByRole("button", { name: "最近見た作品" });
	await openHistory.click();
	await expect(
		viewingHistory.getByRole("link", { name: "会員作品 を開く" }),
	).toBeVisible();
	await viewingHistory
		.getByRole("button", { name: "閉じる", exact: true })
		.click();
	await page.getByRole("button", { name: "一覧に戻る" }).click();
	await expect(page).toHaveURL(/\/pixiv$/);
	const started = Date.now();
	await page.clock.setFixedTime(started);
	countRestoredChecks = true;
	const checked = () =>
		page.waitForResponse("**/api/rpc/viewer/checkPixivSession");
	const firstCheck = checked();
	await page.reload();
	await expect(
		page.getByRole("link", { name: "会員作品 を開く" }),
	).toBeVisible();
	await expect.poll(() => checkCount).toBe(1);
	const focusViewer = () =>
		page.evaluate(() => {
			window.dispatchEvent(new Event("focus"));
			window.dispatchEvent(new Event("focus"));
		});
	// The first request still owns the check even after a minute passes.
	await page.clock.setFixedTime(started + 90_000);
	await focusViewer();
	restoredCheck.resolve();
	await (await firstCheck).finished();
	await focusViewer();
	await page.clock.setFixedTime(started + 151_000);
	const nextCheck = checked();
	await focusViewer();
	await nextCheck;
	expect(checkCount).toBe(2);
	await openPixivAction(page, "pixiv ID 123");
	await dialog
		.getByRole("button", { name: "この ビューアー からログアウト" })
		.click();
	await expect(
		page.getByRole("link", { name: "公開作品 を開く" }),
	).toBeVisible();
	await expect(page.getByRole("link", { name: "会員作品 を開く" })).toHaveCount(
		0,
	);
	await openPixivAction(page, "最近見た作品");
	await expect(viewingHistory.getByText("閲覧履歴はありません")).toBeVisible();
	await page.reload();
	await openPixivAction(page, "pixiv にログイン");
	await dialog.getByRole("button", { name: "拡張機能を使わずに接続" }).click();
	await dialog.getByLabel("PHPSESSID").fill(fixtureSession);
	await dialog.getByRole("button", { name: "接続する" }).click();
	await expect(
		page.getByRole("link", { name: "会員作品 を開く" }),
	).toBeVisible();
	expect(
		await page.evaluate(() => JSON.stringify(sessionStorage)),
	).not.toContain(fixtureSession);
});

test("pixiv ugoira switches between the preview and shared video player", async ({
	page,
}, info) => {
	const animation = pixivArtworkSchema.parse({
		...artwork,
		pages: [artwork.pages[0]],
		pageCount: 1,
		isAnimation: true,
		animation: {
			zip: "https://i.pximg.net/img-zip-ugoira/img/2026/01/01/00/00/00/123_ugoira640x400.zip",
			metadata: { frames: [{ file: "000000.jpg", delay: 100 }] },
		},
	});
	await mockPixivDetail(page, animation);
	await page.route("**/api/pixiv-animation/123", (route) =>
		route.fulfill({
			path: "src/tests/e2e/ui-gallery/video-player.webm",
			contentType: "video/webm",
		}),
	);
	await page.goto(
		info.project.name === "tauri" ? "/#/pixiv/123" : "/pixiv/123",
	);
	const detail = page.getByRole("region", { name: "pixiv #123" });
	await expect(detail.getByRole("img", { name: artwork.title })).toBeVisible();
	await expect(
		detail.getByRole("button", { name: "ページを選ぶ" }),
	).toHaveCount(0);
	await detail.getByRole("button", { name: "うごイラを再生" }).click();
	const video = detail.locator("video");
	await expect(video).toHaveAttribute("src", /^blob:/);
	await expect
		.poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState))
		.toBeGreaterThanOrEqual(1);
	await detail.getByRole("button", { name: "プレビュー画像に戻る" }).click();
	await expect(video).toHaveCount(0);
	await expect(detail.getByRole("img", { name: artwork.title })).toBeVisible();
});

test("pixiv keeps the ranking on a failed append, retries the same page and starts a new tag from the top", async ({
	page,
	browserHealth,
}, info) => {
	const requests: z.infer<typeof viewerRequestSchema>[] = [];
	let failAppend = true;
	browserHealth.allowResponseFailure("/api/rpc/viewer/search");
	browserHealth.allowConsole(
		"Failed to load resource: the server responded with a status of 503",
	);
	await page.route("**/api/rpc/viewer/suggestTags", (route) =>
		route.fulfill({ json: { json: [] } }),
	);
	await page.route("**/api/rpc/viewer/search", async (route) => {
		const query = viewerRequestSchema.parse(
			route.request().postDataJSON().json,
		);
		requests.push(query);
		if (query.page === 2 && failAppend) {
			await route.fulfill({
				status: 503,
				contentType: "text/plain",
				body: "Service Unavailable",
			});
			return;
		}
		const ranking = query.tags === "";
		const start = ranking ? query.page * 100 + 1 : 301;
		const count =
			ranking && query.page <= 2 ? 40 : !ranking && query.page === 1 ? 1 : 0;
		const posts = Array.from({ length: count }, (_, i) => ({
			id: start + i,
			title: `作品 ${start + i}`,
			author: "作者",
			thumbnail: null,
			pageCount: 1,
		}));
		await route.fulfill({
			json: {
				json: {
					provider: "pixiv",
					posts,
					hasNextPage: ranking && query.page === 1,
					word: query.tags,
					mappings: [],
				},
			},
		});
	});
	await page.goto(info.project.name === "tauri" ? "/#/pixiv" : "/pixiv");
	const grid = page.getByRole("region", {
		name: "メディアグリッド",
		exact: true,
	});
	const first = grid.getByRole("link", {
		name: "作品 101 を開く",
		exact: true,
	});
	const next = grid.getByRole("link", { name: "作品 201 を開く", exact: true });
	const scroller = page.locator('[data-media-scroll="pixiv"]');
	await expect(first).toBeVisible();
	await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
	const retry = scroller.getByRole("button", { name: /再試行/ });
	await expect(retry).toBeVisible();
	await expect(first).toHaveCount(1);
	await expect(next).toHaveCount(0);
	expect(requests.map(({ page }) => page)).toEqual([1, 2]);

	failAppend = false;
	await retry.click();
	await expect(next).toHaveCount(1);
	await expect(first).toHaveCount(1);
	await expect(grid.getByRole("link")).toHaveCount(80);
	await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
	await expect(
		grid.getByRole("link", { name: "作品 240 を開く", exact: true }),
	).toBeInViewport();

	const input = page.getByRole("combobox", { name: "pixiv を検索" });
	await input.fill("landscape");
	await page.getByRole("button", { name: "検索", exact: true }).click();
	await expect(
		grid.getByRole("link", { name: "作品 301 を開く", exact: true }),
	).toBeInViewport();
	await expect(grid.getByRole("link")).toHaveCount(1);
	await expect(first).toHaveCount(0);
	await expect(next).toHaveCount(0);
	await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(0);
	expect(requests.map(({ tags, page }) => [tags, page])).toEqual([
		["", 1],
		["", 2],
		["", 2],
		["landscape", 1],
	]);
});

test("a late 401 from a closed pixiv viewer preserves its replacement session", async ({
	page,
	browserHealth,
}, info) => {
	browserHealth.allowResponseFailure("/api/rpc/viewer/checkPixivSession");
	browserHealth.allowConsole(
		"Failed to load resource: the server responded with a status of 401",
	);
	const oldToken = "A".repeat(43);
	const newToken = "B".repeat(43);
	const releaseOldCheck = Promise.withResolvers<void>();
	const oldCheckStarted = Promise.withResolvers<void>();
	let logins = 0;
	let checks = 0;
	await page.route("**/api/rpc/viewer/**", async (route) => {
		if (route.request().url().endsWith("/pixivRelatedPage")) {
			await route.fulfill({ json: { json: { posts: [], nextIds: [] } } });
			return;
		}
		const method = new URL(route.request().url()).pathname.split("/").at(-1);
		if (method === "loginPixiv") {
			await route.fulfill({
				json: {
					json: {
						token: ++logins === 1 ? oldToken : newToken,
						userId: "123",
						expiresAt: Date.now() + 3600000,
					},
				},
			});
		} else if (method === "checkPixivSession") {
			if (route.request().headers().authorization === "Bearer " + oldToken) {
				if (++checks === 1) {
					oldCheckStarted.resolve();
					await releaseOldCheck.promise;
				}
				await route.fulfill({
					status: 401,
					json: { json: { code: "UNAUTHORIZED", message: "expired" } },
				});
			} else {
				await route.fulfill({ json: { json: { userId: "123" } } });
			}
		} else {
			const provider = route.request().postDataJSON().json.provider;
			await route.fulfill({
				json: {
					json: {
						provider,
						posts: [],
						hasNextPage: false,
						word: "",
						mappings: [],
					},
				},
			});
		}
	});
	const login = async () => {
		await openPixivAction(page, "pixiv にログイン");
		const dialog = page.getByRole("dialog", { name: "pixiv アカウント" });
		await dialog.getByLabel("接続コード").fill("X".repeat(22));
		await dialog.getByRole("button", { name: "接続する" }).click();
		await pixivActions(page).click();
		await expect(
			page.getByRole("menuitem", { name: "pixiv ID 123" }),
		).toBeVisible();
		await page.keyboard.press("Escape");
	};
	await page.goto(info.project.name === "tauri" ? "/#/pixiv" : "/pixiv");
	await login();
	await page.reload();
	await oldCheckStarted.promise;
	await navigateTo(page, "Danbooru");
	await expect(
		page.getByRole("heading", { name: "Danbooru", exact: true }),
	).toBeVisible();
	await navigateTo(page, "pixiv");
	await login();
	const oldResponse = page.waitForResponse(
		"**/api/rpc/viewer/checkPixivSession",
	);
	releaseOldCheck.resolve();
	await (await oldResponse).finished();
	const restored = page.waitForRequest(
		(request) =>
			new URL(request.url()).pathname.endsWith("/viewer/checkPixivSession") &&
			request.headers().authorization === "Bearer " + newToken,
	);
	await page.reload();
	await restored;
	await pixivActions(page).click();
	await expect(
		page.getByRole("menuitem", { name: "pixiv ID 123" }),
	).toBeVisible();
});
