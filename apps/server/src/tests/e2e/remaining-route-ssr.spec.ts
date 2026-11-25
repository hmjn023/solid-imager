import { rm, writeFile } from "node:fs/promises";
import { statisticsResponseSchema } from "@solid-imager/core/statistics";
import { apiRequest } from "./support/api";
import {
	E2E_PRIMARY_FILE_NAME,
	externalViewerFixturePath,
	getFixtureMediaPath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

const postId = 76241001;
const pixivTitle = "SSR fixture illustration";
const danbooruTag = "ssr_fixture_tag";
const preview = `https://i.pximg.net/img-master/img/e2e-ssr/${postId}_p0_master1200.png`;
const pixivLargeThumbnail = preview.replace(
	"/img-master/",
	"/c/480x960/img-master/",
);
const pixivSmallThumbnail = pixivLargeThumbnail.replace(
	"/c/480x960/",
	"/c/240x480/",
);
const danbooruThumbnail = "https://cdn.donmai.us/180x180/ab/cd/abcd.jpg";
const danbooruPost = {
	id: postId,
	rating: "g",
	created_at: "2026-01-01T00:00:00Z",
	tag_string_general: danbooruTag,
	file_ext: "png",
	preview_file_url: danbooruThumbnail,
};

test.describe("public viewer SSR", () => {
	test.beforeAll(() =>
		writeFile(
			externalViewerFixturePath(),
			JSON.stringify({
				"/posts.json": [danbooruPost],
				[`/posts/${postId}.json`]: danbooruPost,
				"/ranking.php": {
					contents: [
						{
							illust_id: postId,
							title: pixivTitle,
							user_name: "SSR fixture artist",
							url: pixivLargeThumbnail,
							illust_page_count: 1,
						},
					],
					next: false,
				},
				[`/ajax/illust/${postId}`]: {
					error: false,
					body: {
						id: String(postId),
						title: pixivTitle,
						userId: "47",
						userName: "SSR fixture artist",
						createDate: "2026-01-01T00:00:00Z",
						illustType: 0,
						pageCount: 1,
						width: 64,
						height: 64,
						urls: { regular: preview },
						tags: { tags: [{ tag: "SSR fixture metadata" }] },
					},
				},
				[`/ajax/illust/${postId}/pages`]: {
					error: false,
					body: [{ urls: { regular: preview }, width: 64, height: 64 }],
				},
				[`/ajax/illust/${postId}/recommend/init`]: {
					error: false,
					body: { illusts: [] },
				},
			}),
		),
	);
	// Keep the fixture available until the viewer pages and their requests close.
	test.afterAll(() => rm(externalViewerFixturePath(), { force: true }));

	for (const route of [
		{
			path: "/danbooru",
			text: `Danbooru #${postId}`,
			endpoint: "/api/viewer/search",
			thumbnail: danbooruThumbnail,
		},
		{
			path: `/danbooru/${postId}`,
			text: danbooruTag,
			endpoint: `/api/danbooru/posts/${postId}`,
		},
		{
			path: "/pixiv",
			text: pixivTitle,
			endpoint: "/api/viewer/search",
			thumbnail: pixivSmallThumbnail,
		},
		{
			path: `/pixiv/${postId}`,
			text: "SSR fixture metadata",
			endpoint: `/api/viewer/pixiv/posts/${postId}`,
		},
	]) {
		test(`${route.path} renders provider data and reuses it after hydration`, async ({
			baseURL,
			browser,
			browserHealth,
			page,
		}) => {
			const context = await browser.newContext({
				baseURL,
				javaScriptEnabled: false,
			});
			const image = /\/api\/viewer\/(?:pixiv\/image|danbooru\/thumbnail)\?/;
			const path = getFixtureMediaPath(E2E_PRIMARY_FILE_NAME);
			await Promise.all([
				context.route(image, (request) => request.fulfill({ path })),
				page.route(image, (request) => request.fulfill({ path })),
			]);
			try {
				const document = await context.newPage();
				expect((await document.goto(route.path))?.ok()).toBe(true);
				await expect(
					document
						.locator("#main-content")
						.getByText(route.text, { exact: true })
						.first(),
				).toBeVisible();
				if (route.thumbnail) {
					const img = document.locator(`[data-media-id="${postId}"] img`);
					const src = await img.getAttribute("src");
					expect(new URL(src ?? "", baseURL).searchParams.get("url")).toBe(
						route.thumbnail,
					);
					await expect(img).toHaveAttribute("loading", "eager");
					await expect(img).toHaveAttribute("fetchpriority", "high");
					await expect
						.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
						.toBeGreaterThan(0);
					if (route.path === "/pixiv")
						await expect(img).toHaveAttribute("srcset", / 1x, .* 2x$/);
				}
				if (route.path === `/danbooru/${postId}`) {
					await context.addCookies([
						{ name: "solid-imager.locale", value: "en", url: document.url() },
					]);
					await document.reload();
					await expect(
						document.getByRole("heading", { name: "Tags", exact: true }),
					).toBeVisible();
				}
			} finally {
				await context.close();
			}

			for (const navigate of [
				() => page.goto(route.path),
				() => page.reload(),
			]) {
				const checkpoint = browserHealth.requestCheckpoint();
				expect((await navigate())?.ok()).toBe(true);
				await waitForAppHydration(page);
				await expect(
					page
						.locator("#main-content")
						.getByText(route.text, { exact: true })
						.first(),
				).toBeVisible();
				expect(
					browserHealth.apiRequestCountPathSince(checkpoint, route.endpoint),
				).toBe(0);
			}
		});
	}

	test("Pixiv retries a missing 240px thumbnail with the upstream variant", async ({
		browserHealth,
		page,
	}) => {
		const urlOfImage = (url: URL) => url.searchParams.get("url");
		const missing = (url: URL) => urlOfImage(url) === pixivSmallThumbnail;
		browserHealth.allowResponseFailure(
			/\/api\/viewer\/pixiv\/image\?.*240x480/,
		);
		browserHealth.allowConsole(
			"Failed to load resource: the server responded with a status of 404",
		);
		await page.route(missing, (request) => request.fulfill({ status: 404 }));
		await page.route(
			(url) => urlOfImage(url) === pixivLargeThumbnail,
			(request) =>
				request.fulfill({ path: getFixtureMediaPath(E2E_PRIMARY_FILE_NAME) }),
		);
		await page.goto("/pixiv");
		const img = page.locator(`[data-media-id="${postId}"] img`);
		await expect(img).toHaveAttribute("src", /480x960/);
		await expect
			.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
			.toBeGreaterThan(0);
	});
});

test("statistics renders charts with the reporting time zone and reuses the query on reload", async ({
	baseURL,
	browser,
	browserHealth,
	context,
	page,
}) => {
	const zone = await page.evaluate(
		() => Intl.DateTimeFormat().resolvedOptions().timeZone,
	);
	const statistics = await apiRequest(page.request, "media/statistics", {
		period: "all",
		timeZone: zone,
	});
	await expect(statistics).toBeOK();
	const { mediaTypes } = statisticsResponseSchema.parse(
		await statistics.json(),
	);
	const imageCount =
		mediaTypes.find((entry) => entry.type === "image")?.count ?? 0;
	expect(imageCount).toBeGreaterThan(0);
	const cookie = {
		name: "solid-imager.statistics-time-zone",
		value: encodeURIComponent(zone),
		url: baseURL ?? page.url(),
	};
	const documentContext = await browser.newContext({
		baseURL,
		javaScriptEnabled: false,
	});
	try {
		const document = await documentContext.newPage();
		expect((await document.goto("/statistics?period=all"))?.ok()).toBe(true);
		await expect(
			document.getByRole("heading", { name: "ライブラリ統計", exact: true }),
		).toBeVisible();
		await expect(
			document.getByRole("heading", { name: "メディアの内訳", exact: true }),
		).toHaveCount(0);
		await documentContext.addCookies([cookie]);
		expect((await document.reload())?.ok()).toBe(true);
		await expect(
			document.getByRole("heading", { name: "メディアの内訳", exact: true }),
		).toBeVisible();
		await expect(
			document
				.getByText(`${imageCount.toLocaleString("ja-JP")}件`, { exact: true })
				.first(),
		).toBeVisible();
	} finally {
		await documentContext.close();
	}
	const endpoint = "/api/media/statistics";
	const firstVisit = browserHealth.requestCheckpoint();
	const [firstQuery] = await Promise.all([
		page.waitForRequest(
			(request) => new URL(request.url()).pathname === endpoint,
		),
		page.goto("/statistics?period=all"),
	]);
	expect(firstQuery.postDataJSON()).toMatchObject({ timeZone: zone });
	await waitForAppHydration(page);
	await expect(
		page.getByRole("heading", { name: "メディアの内訳", exact: true }),
	).toBeVisible();
	expect(browserHealth.apiRequestCountPathSince(firstVisit, endpoint)).toBe(1);
	expect(await context.cookies()).toContainEqual(
		expect.objectContaining({
			name: cookie.name,
			value: cookie.value,
		}),
	);
	for (const navigate of [
		() => page.goto("/statistics?period=all"),
		() => page.reload(),
	]) {
		const checkpoint = browserHealth.requestCheckpoint();
		expect((await navigate())?.ok()).toBe(true);
		await waitForAppHydration(page);
		await expect(
			page.getByRole("heading", { name: "メディアの内訳", exact: true }),
		).toBeVisible();
		expect(browserHealth.apiRequestCountPathSince(checkpoint, endpoint)).toBe(
			0,
		);
	}
});
