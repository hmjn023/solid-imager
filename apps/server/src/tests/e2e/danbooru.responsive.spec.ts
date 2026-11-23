import type { Locator, Page, Route } from "@playwright/test";
import {
	danbooruPostSchema,
	danbooruSearchSchema,
	type DanbooruSearch,
} from "@solid-imager/core/danbooru";
import { pendingImportJobSchema } from "@solid-imager/core/media";
import { z } from "zod";
import {
	apiPathPattern,
	apiRequest,
	apiRequestInput,
	apiResponse,
	apiRoute,
	routeApi,
} from "./support/api";
import { E2E_PRIMARY_MEDIA_ID } from "./support/fixture";
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

async function mockDanbooru(
	page: Page,
	pageSizes = [40, 39],
	overlap = false,
	createPost = post,
) {
	const searches: DanbooruSearch[] = [];
	const fulfillImage = (route: Route) =>
		route.fulfill({
			contentType: "image/svg+xml",
			body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#dae6e8"/><path d="M0 900 480 250 1200 900" fill="#608080"/></svg>',
		});
	await page.route(apiRoute("viewer/danbooruThumbnail"), fulfillImage);
	await page.route("https://cdn.donmai.us/original/**", fulfillImage);
	for (const operation of ["viewer/search", "danbooru/search"]) {
		await routeApi(page, operation, (route) => {
			const query = danbooruSearchSchema.parse(route.request().postDataJSON());
			searches.push(query);
			const start = query.page * 100 + 1;
			return route.fulfill({
				json: {
					provider: "danbooru",
					posts: Array.from(
						{ length: pageSizes[query.page - 1] ?? 0 },
						(_, i) =>
							createPost(
								overlap && query.page > 1 && i === 0
									? (query.page - 1) * 100 + pageSizes[query.page - 2]
									: start + i,
							),
					),
					hasNextPage: query.page < pageSizes.length,
				},
			});
		});
	}
	await routeApi(page, "danbooru/getPost", (route) =>
		route.fulfill({
			json: createPost(
				Number(apiRequestInput(route.request(), "danbooru/getPost").id),
			),
		}),
	);
	for (const operation of ["viewer/suggestTags", "danbooru/suggestTags"]) {
		await routeApi(page, operation, (route) =>
			route.fulfill({
				json: [{ name: "landscape", category: 0, postCount: 1234 }],
			}),
		);
	}
	return searches;
}

async function expectNoOverflow(page: Page) {
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth,
		),
	).toBe(true);
}

test("Danbooru video imports preserve the original and metadata after navigation and reload", async ({
	page,
	browserHealth,
}, info) => {
	browserHealth.allowRequestFailure(
		apiPathPattern("sources/list"),
		"net::ERR_ABORTED",
	);
	const videoPost = {
		...post(101),
		fileExt: "webm",
		fileUrl: "https://cdn.donmai.us/original/101.webm",
		sampleUrl: "https://cdn.donmai.us/sample/101.webm",
	};
	await mockDanbooru(page, [40], false, (id) =>
		id === videoPost.id ? videoPost : post(id),
	);
	await page.route(videoPost.fileUrl, (route) =>
		route.fulfill({
			path: "src/tests/e2e/ui-gallery/video-player.webm",
			contentType: "video/webm",
		}),
	);
	await page.goto(info.project.name === "tauri" ? "/#/danbooru" : "/danbooru");
	await page
		.getByRole("link", { name: "Danbooru #101 を開く", exact: true })
		.click();
	const detail = page.getByRole("region", {
		name: "Danbooru #101",
		exact: true,
	});
	const add = detail.getByRole("button", {
		name: "動画を取り込み待ちへ",
		exact: true,
	});
	await expect(add).toBeEnabled();
	await expect
		.poll(() =>
			detail.locator("video").evaluate((el: HTMLVideoElement) => ({
				loaded: el.readyState >= 1,
				error: el.error?.message ?? null,
			})),
		)
		.toEqual({ loaded: true, error: null });
	await page.reload();
	await expect(add).toBeEnabled();
	await expect(detail.locator("video")).toHaveAttribute(
		"src",
		videoPost.fileUrl,
	);
	// Importing uses the original URL independently of the player's reload/preload state.
	const added = page.waitForResponse(
		(response) => apiResponse("imports/bulkAdd")(response) && response.ok(),
	);
	await add.click();
	await added;
	await expect(
		detail.getByRole("button", { name: "取り込み待ちに追加済み", exact: true }),
	).toBeDisabled();
	await page.getByRole("button", { name: "通知を閉じる" }).click();
	const pending = await apiRequest(page.request, "imports/listPending");
	const jobs = z.array(pendingImportJobSchema).parse(await pending.json());
	const job = jobs.find((entry) => entry.item.targetUrl === videoPost.fileUrl);
	expect(job).toBeDefined();
	expect(job?.item.previewUrl).toBe(videoPost.previewUrl);
	expect(job?.item.sourceUrls).toEqual([
		videoPost.fileUrl,
		videoPost.source,
		"https://danbooru.donmai.us/posts/101",
	]);
	expect(job?.item.authors?.[0].accountId).toBe("test_artist");
	expect(job?.item.characters?.[0].name).toBe("test_character");
	expect(job?.item.ips?.[0].name).toBe("test_series");
	expect(job?.item.tags?.map((tag) => tag.name)).toEqual([
		"landscape",
		"blue_sky",
		"highres",
	]);
	if (job) {
		const cancelled = await apiRequest(page.request, "imports/cancel", {
			jobIds: [job.id],
		});
		expect(cancelled.ok()).toBe(true);
	}
	await expect(add).toBeEnabled();
	await expect(detail).toBeVisible();
	const readded = page.waitForResponse(
		(response) => apiResponse("imports/bulkAdd")(response) && response.ok(),
	);
	await add.click();
	await readded;
	const list = await apiRequest(page.request, "imports/listPending");
	const readdedJobs = z
		.array(pendingImportJobSchema)
		.parse(await list.json())
		.filter((entry) => entry.item.targetUrl === videoPost.fileUrl);
	expect(readdedJobs).toHaveLength(1);
	expect(readdedJobs[0]?.id).not.toBe(job?.id);
	const cleanup = await apiRequest(page.request, "imports/cancel", {
		jobIds: readdedJobs.map((entry) => entry.id),
	});
	expect(cleanup.ok()).toBe(true);
});

test("Danbooru can re-add a receipt cancelled while the import event connection is down", async ({
	page,
}, info) => {
	const reconnect = Promise.withResolvers<void>();
	let attempts = 0;
	await routeApi(page, "imports/events", async (route) => {
		if (++attempts === 1) {
			await route.fulfill({
				contentType: "text/event-stream",
				body: ": closed\n\n",
			});
			return;
		}
		await reconnect.promise;
		await route.continue();
	});
	await mockDanbooru(page, [1]);
	await page.goto(
		info.project.name === "tauri" ? "/#/danbooru/1420" : "/danbooru/1420",
	);
	await expect.poll(() => attempts).toBe(2);
	const detail = page.getByRole("region", {
		name: "Danbooru #1420",
		exact: true,
	});
	const add = detail.getByRole("button", {
		name: "画像を取り込み待ちへ",
		exact: true,
	});
	const submitted = page.waitForResponse(
		(response) => apiResponse("imports/bulkAdd")(response) && response.ok(),
	);
	await add.click();
	const { createdRequests } = await (await submitted).json();
	const jobIds = z
		.array(z.object({ id: z.uuid() }))
		.parse(createdRequests)
		.map(({ id }) => id);
	expect(jobIds).toHaveLength(1);
	const queued = detail.getByRole("button", {
		name: "取り込み待ちに追加済み",
		exact: true,
	});
	await expect(queued).toBeDisabled();
	try {
		const cancelled = await apiRequest(page.request, "imports/cancel", {
			jobIds,
		});
		expect(cancelled.ok()).toBe(true);
		await expect(queued).toBeDisabled();
	} finally {
		reconnect.resolve();
	}
	await expect(add).toBeEnabled();
});

test("Danbooru sidebar, completion, scrolling, viewer, imports and reload", async ({
	page,
	browserHealth,
}, testInfo) => {
	// Import invalidation and the deliberate reload can cancel a pending source refresh.
	browserHealth.allowRequestFailure(
		apiPathPattern("sources/list"),
		"net::ERR_ABORTED",
	);
	const searches = await mockDanbooru(page);
	const appPath = (path: string) =>
		testInfo.project.name === "tauri" ? `/#${path}` : path;
	const menu = page.getByRole("button", {
		name: "メニューを開く",
		exact: true,
	});
	if (testInfo.project.name === "responsive-390") {
		const scripts = Promise.withResolvers<void>();
		const holdScripts = async (route: Route) => {
			if (route.request().resourceType() === "script") await scripts.promise;
			await route.fallback();
		};
		await page.route("**/*", holdScripts);
		try {
			await page.goto(appPath("/search"), { waitUntil: "commit" });
			await expect(menu).toBeVisible();
			await expect(page.locator("html")).toHaveAttribute(
				"data-hydrated",
				"false",
			);
			await expect(menu).toBeDisabled();
		} finally {
			scripts.resolve();
			await page.unroute("**/*", holdScripts);
		}
	} else {
		await page.goto(appPath("/search"));
	}
	await expect(
		page.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`),
	).toBeVisible();
	if (await menu.isVisible()) {
		await expect(menu).toBeEnabled();
		await menu.click();
		await expect(
			page.getByRole("dialog", { name: "ナビゲーション" }),
		).toBeVisible();
	}
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
	const thumbnail = page.locator('[data-media-id="101"] img');
	await expect
		.poll(() => thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth))
		.toBeGreaterThan(0);
	const input = page.getByRole("combobox", {
		name: "Danbooru を検索",
		exact: true,
	});
	await input.fill("land");
	await page.getByRole("option", { name: /landscape/ }).click();
	await expect(input).toHaveValue("landscape ");
	await page.getByRole("button", { name: "検索", exact: true }).click();
	await expect.poll(() => searches.at(-1)?.tags).toBe("landscape");
	const scroller = page.locator('[data-media-scroll="Danbooru"]');
	const first = page.getByRole("link", {
		name: "Danbooru #101 を開く",
		exact: true,
	});
	const nextPage = page.getByRole("link", {
		name: "Danbooru #201 を開く",
		exact: true,
	});
	await expect(first).toBeVisible();
	await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
	await expect(nextPage).toBeVisible();
	await expect(first).toHaveCount(1);
	expect(
		searches.filter((s) => s.tags === "landscape").map((s) => s.page),
	).toEqual([1, 2]);
	await expectNoOverflow(page);
	await nextPage.click();
	await expect(page).toHaveURL(/\/danbooru\/201$/);
	const detail = page.getByRole("region", {
		name: "Danbooru #201",
		exact: true,
	});
	await expect(detail).toBeVisible();
	await expect(input).toHaveCount(0);
	await detail.getByRole("button", { name: "前の投稿", exact: true }).click();
	const previous = page.getByRole("region", {
		name: "Danbooru #140",
		exact: true,
	});
	await expect(previous).toBeVisible();
	await previous.getByRole("button", { name: "次の投稿", exact: true }).click();
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
		.getByRole("button", { name: "Danbooru #201の画像ビューアーを開く" })
		.click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await expect(page).toHaveURL(/\/danbooru\/201$/);
	const added = page.waitForResponse(
		(response) => apiResponse("imports/bulkAdd")(response) && response.ok(),
	);
	await detail
		.getByRole("button", { name: "画像を取り込み待ちへ", exact: true })
		.click();
	await added;
	await expect(
		detail.getByRole("button", { name: "取り込み待ちに追加済み", exact: true }),
	).toBeDisabled();
	await page.getByRole("button", { name: "通知を閉じる" }).click();
	const pending = await apiRequest(page.request, "imports/listPending");
	const jobs = z.array(pendingImportJobSchema).parse(await pending.json());
	const item = jobs.find((job) => job.item.targetUrl === post(201).fileUrl);
	expect(item?.item.authors?.[0].accountId).toBe("test_artist");
	expect(item?.item.characters?.[0].name).toBe("test_character");
	expect(item?.item.ips?.[0].name).toBe("test_series");
	if (item) {
		const cancelled = await apiRequest(page.request, "imports/cancel", {
			jobIds: [item.id],
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

async function expectAnchorRestored(
	page: Page,
	grid: Locator,
	scroller: Locator,
	targetId: number,
	searches: DanbooruSearch[],
) {
	const tile = (id: number) =>
		grid.getByRole("link", { name: `Danbooru #${id} を開く`, exact: true });
	await tile(targetId).evaluate((el) => el.scrollIntoView({ block: "start" }));
	const anchor = await scroller.evaluate((el) => {
		const top = el.getBoundingClientRect().top;
		const first = [
			...el.querySelectorAll<HTMLAnchorElement>("a[data-media-id]"),
		].find((item) => item.getBoundingClientRect().bottom > top + 1);
		if (!first) throw new Error("No tile at the top of the scroll area");
		return {
			id: Number(first.dataset.mediaId),
			offset: first.getBoundingClientRect().top - top,
		};
	});
	// A responsive row may start a few posts before the requested tile; restore its leading post.
	expect(Math.floor(anchor.id / 100)).toBe(Math.floor(targetId / 100));
	const current = tile(anchor.id);
	const offsetError = () =>
		current.evaluate((el, offset) => {
			const area = el.closest("[data-media-scroll]");
			if (!area) throw new Error("Missing collection scroll area");
			return Math.abs(
				el.getBoundingClientRect().top -
					area.getBoundingClientRect().top -
					offset,
			);
		}, anchor.offset);

	await current.press("Enter");
	const detail = page.getByRole("region", {
		name: `Danbooru #${anchor.id}`,
		exact: true,
	});
	await detail.getByRole("button", { name: "一覧に戻る", exact: true }).click();
	await expect(current).toBeFocused();
	await expect.poll(offsetError).toBeLessThanOrEqual(2);
	const requestsBeforeReload = searches.length;
	await page.reload();
	await expect(current).toBeInViewport();
	expect(searches[requestsBeforeReload]?.page).toBe(
		Math.floor(anchor.id / 100),
	);
	await expect.poll(offsetError).toBeLessThanOrEqual(2);
}

test("the collection restores the second-page tile on Back and reload and can scroll up to earlier results", async ({
	page,
}, info) => {
	// Keep a full second page scrollable on wide displays with eight grid columns.
	const viewport = page.viewportSize();
	if (viewport && viewport.width >= 1024)
		await page.setViewportSize({ ...viewport, height: 520 });
	const searches = await mockDanbooru(page);
	await page.goto(info.project.name === "tauri" ? "/#/danbooru" : "/danbooru");
	const grid = page.getByRole("region", {
		name: "メディアグリッド",
		exact: true,
	});
	const first = grid.getByRole("link", {
		name: "Danbooru #101 を開く",
		exact: true,
	});
	const scroller = page.locator('[data-media-scroll="Danbooru"]');
	await first.focus();
	await first.press("ArrowRight");
	await expect(
		grid.getByRole("link", { name: "Danbooru #102 を開く" }),
	).toBeFocused();
	await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
	await expect(grid.getByRole("link")).toHaveCount(79);
	await first.press("End");
	const last = grid.getByRole("link", {
		name: "Danbooru #239 を開く",
		exact: true,
	});
	await expect(last).toBeFocused();
	await expectAnchorRestored(page, grid, scroller, 209, searches);
	await scroller.evaluate((el) => el.scrollTo(0, 0));
	await expect(first).toHaveCount(1);
	await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
	await expect(last).toBeInViewport();
	expect(searches.every(({ page }) => page <= 2)).toBe(true);
});

test(
	"a long collection renders bounded rows, merges overlapping pages and restores a late tile",
	{ tag: "@desktop-only" },
	async ({ page }, info) => {
		// Keep the first page taller than the preload margin at desktop widths.
		await page.setViewportSize({ width: 1024, height: 520 });
		const searches = await mockDanbooru(page, [40, 40, 40, 39], true);
		await page.goto(
			info.project.name === "tauri" ? "/#/danbooru" : "/danbooru",
		);
		const grid = page.getByRole("region", {
			name: "メディアグリッド",
			exact: true,
		});
		const scroller = page.locator('[data-media-scroll="Danbooru"]');
		const resultCount = (count: number) =>
			page.locator("header").getByText(`${count}件を表示`, { exact: true });
		await expect(resultCount(40)).toBeVisible();
		await expect(scroller.getByText("40件を表示", { exact: true })).toHaveCount(
			0,
		);
		for (const total of [79, 118, 156]) {
			await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
			await expect(resultCount(total)).toBeVisible();
		}
		expect(searches.map(({ page }) => page)).toEqual([1, 2, 3, 4]);
		await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight * 0.73));
		const late = grid.getByRole("link", {
			name: "Danbooru #410 を開く",
			exact: true,
		});
		await expect(late).toHaveCount(1);
		await expect(
			grid.getByRole("link", { name: "Danbooru #101 を開く", exact: true }),
		).toHaveCount(0);
		expect(await grid.getByRole("link").count()).toBeLessThan(100);
		await expectAnchorRestored(page, grid, scroller, 410, searches);
	},
);

test("Danbooru recovers failed requests without losing search input", async ({
	page,
	browserHealth,
}, testInfo) => {
	await mockDanbooru(page);
	browserHealth.allowResponseFailure(apiPathPattern("viewer/search"));
	browserHealth.allowConsole(
		"Failed to load resource: the server responded with a status of 503",
	);
	let fail = true;
	await routeApi(page, "viewer/search", async (route) => {
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
	const heading = page.getByRole("heading", { name: "Danbooru", exact: true });
	const search = page.getByRole("button", { name: "検索", exact: true });
	const moreActions = page.getByRole("button", {
		name: "その他の操作",
		exact: true,
	});
	const help = page.getByRole("button", { name: "検索の使い方", exact: true });
	const helpPanel = page.getByRole("dialog", {
		name: "検索の使い方",
		exact: true,
	});
	for (const control of [heading, search, moreActions, help]) {
		await expect(control).toBeVisible();
	}
	const headingBounds = await heading.boundingBox();
	const searchBounds = await search.boundingBox();
	const toolsBounds = await moreActions.boundingBox();
	expect(headingBounds?.y).toBeLessThan(searchBounds?.y ?? 0);
	expect(searchBounds?.y).toBeLessThan(toolsBounds?.y ?? 0);

	await expect(helpPanel).toBeHidden();
	await help.focus();
	await help.press("Enter");
	await expect(helpPanel).toContainText("rating:g や order:score");
	await page.keyboard.press("Escape");
	await expect(helpPanel).toBeHidden();
	await expect(help).toBeFocused();
	await expect(page.locator('[role="dialog"]')).toHaveCount(0);

	await moreActions.focus();
	await moreActions.press("ArrowDown");
	await expect(
		page.getByRole("menuitem", { name: "サイトを開く ↗", exact: true }),
	).toHaveAttribute("href", "https://danbooru.donmai.us");
	await page.keyboard.press("Escape");
	await expect(moreActions).toBeFocused();
	await expect(page.locator('[role="menu"]')).toHaveCount(0);
	await expectNoOverflow(page);

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
