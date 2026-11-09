import { expect, test } from "./support/test";
import type { Page } from "@playwright/test";
import {
	viewerRequestSchema,
	pixivArtworkSchema,
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

test("switches the same canonical tag between viewers, chooses a pixiv name and imports the selected page", async ({
	page,
}, info) => {
	const path = (s: string) => (info.project.name === "tauri" ? "/#" + s : s);
	await mockPixivImage(page);
	const requests: z.infer<typeof viewerRequestSchema>[] = [];
	await page.route("**/api/rpc/viewer/**", async (route) => {
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
	const input = page.getByRole("combobox", { name: "Danbooru を検索" });
	await input.fill("land");
	await page.getByRole("option", { name: /landscape/ }).click();
	await page.getByRole("button", { name: "検索", exact: true }).click();
	await expect.poll(() => requests.at(-1)?.tags).toBe("landscape");
	await navigateTo(page, "pixiv");
	await expect(
		page.getByRole("combobox", { name: "pixiv を検索" }),
	).toHaveValue("landscape ");
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
	const pending = await page.request.post("/api/rpc/imports/listPending", {
		data: { json: {} },
	});
	const jobs = z
		.array(pendingImportJobSchema)
		.parse((await pending.json()).json);
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
	await page.route("**/api/rpc/viewer/**", async (route) => {
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
	await page.getByRole("button", { name: "pixiv にログイン" }).click();
	const dialog = page.getByRole("dialog", { name: "pixiv アカウント" });
	await expect(
		dialog.getByRole("link", { name: "公式 pixiv でログイン ↗" }),
	).toHaveAttribute("href", "https://accounts.pixiv.net/login");
	await dialog.getByLabel("接続コード").fill("bad");
	await dialog.getByRole("button", { name: "接続する" }).click();
	await expect(dialog.getByRole("alert")).toContainText("接続コード");
	await dialog.getByLabel("接続コード").fill(code);
	await dialog.getByRole("button", { name: "接続する" }).click();
	await expect(
		page.getByRole("link", { name: "会員作品 を開く" }),
	).toBeVisible();
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
	await page.getByRole("button", { name: "pixiv ID 123" }).click();
	await dialog
		.getByRole("button", { name: "この Viewer からログアウト" })
		.click();
	await expect(
		page.getByRole("link", { name: "公開作品 を開く" }),
	).toBeVisible();
	await expect(page.getByRole("link", { name: "会員作品 を開く" })).toHaveCount(
		0,
	);
	await page.reload();
	await page.getByRole("button", { name: "pixiv にログイン" }).click();
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
	await mockPixivImage(page);
	await page.route("**/api/rpc/viewer/search", (route) =>
		route.fulfill({
			json: {
				json: {
					provider: "pixiv",
					posts: [artwork],
					hasNextPage: false,
					word: "",
					mappings: [],
				},
			},
		}),
	);
	await page.route("**/api/rpc/viewer/pixivArtwork", (route) =>
		route.fulfill({ json: { json: animation } }),
	);
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
