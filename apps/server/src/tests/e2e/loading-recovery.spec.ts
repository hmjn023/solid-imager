import { apiPathPattern, apiRequest, routeApi } from "./support/api";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { mediaSourceInfoSchema } from "@solid-imager/core/sources";
import type { Locator, Page } from "@playwright/test";
import {
	E2E_PRIMARY_FILE_NAME,
	getE2eRuntimeDir,
	mediaPath,
	sourcePath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

const searchEndpoint = apiPathPattern("media/search");
const mediaDetailsEndpoint = apiPathPattern("media/getDetails");
const networkFailures = [
	{
		name: "connection failed",
		errorCode: "connectionfailed",
		consoleMessage: "net::ERR_CONNECTION_FAILED",
	},
	{
		name: "connection refused",
		errorCode: "connectionrefused",
		consoleMessage: "net::ERR_CONNECTION_REFUSED",
	},
	{
		name: "timed out",
		errorCode: "timedout",
		consoleMessage: "net::ERR_TIMED_OUT",
	},
	{
		name: "connection reset",
		errorCode: "connectionreset",
		consoleMessage: "net::ERR_CONNECTION_RESET",
	},
] as const;

async function getGridColumnCount(
	root: Locator | Page,
	selector: string,
): Promise<number> {
	return await root
		.locator(selector)
		.evaluate(
			(element) =>
				window.getComputedStyle(element).gridTemplateColumns.split(" ").length,
		);
}

async function getVisibleSkeletonItemCount(root: Locator): Promise<number> {
	return await root
		.locator(':scope > div > [aria-hidden="true"]')
		.evaluateAll(
			(elements) =>
				elements.filter(
					(element) => window.getComputedStyle(element).display !== "none",
				).length,
		);
}

async function openLibraryFromAbout(page: Page) {
	await page.goto("/about");
	await waitForAppHydration(page);
	await page.getByRole("link", { name: "ライブラリ", exact: true }).click();
}

test.describe("loading and recovery", () => {
	test("keeps the current screen visible while the destination code loads", async ({
		page,
	}) => {
		await page.goto("/about");
		await waitForAppHydration(page);
		const release = Promise.withResolvers<void>();
		await page.route(
			(url) =>
				/\/assets\/search-[\w-]+\.js$/.test(url.pathname) ||
				(url.pathname.endsWith("/routes/search.tsx") &&
					url.searchParams.has("tsr-split")),
			async (route) => {
				await release.promise;
				await route.continue();
			},
		);

		try {
			await page.getByRole("link", { name: "ライブラリ", exact: true }).click();
			await expect(
				page.getByRole("progressbar", { name: "画面を読み込んでいます" }),
			).toBeVisible();
			await expect(
				page.getByRole("heading", { name: "Solid Imagerについて", level: 1 }),
			).toBeVisible();
			await expect(page.locator("[data-screen-skeleton]")).toHaveCount(0);
		} finally {
			release.resolve();
		}

		await expect(
			page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
		).toBeVisible();
	});

	test("keeps the app shell visible while the initial search response is delayed", async ({
		page,
	}) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		let releaseRequest: () => void = () => {};
		const requestGate = new Promise<void>((resolve) => {
			releaseRequest = resolve;
		});
		await page.route(searchEndpoint, async (route) => {
			await requestGate;
			await route.continue();
		});

		await openLibraryFromAbout(page);
		await expect(
			page.getByRole("link", { name: "ライブラリ", exact: true }),
		).toBeVisible();
		const screenSkeleton = page.locator('[data-screen-skeleton="media-grid"]');
		// Production can mount the route content before the route-level fallback
		// becomes observable. The media-grid loading region is the stable state
		// shared by both render paths while the search request is gated.
		const loadingRegion = page
			.locator('[aria-busy="true"]')
			.filter({ has: page.locator('[data-skeleton="media-grid"]') })
			.first();
		const skeletonGrid = loadingRegion
			.locator('[data-skeleton="media-grid"]:visible')
			.first();
		await expect(loadingRegion).toBeVisible();
		await expect(skeletonGrid).toBeVisible();
		await page.waitForLoadState("load");
		await expect(
			skeletonGrid.locator(':scope > div > [aria-hidden="true"]').first(),
		).toHaveCSS("animation-name", "none");
		const skeletonColumnCount = await getGridColumnCount(
			skeletonGrid,
			":scope > div",
		);
		const placeholder = await skeletonGrid
			.locator(':scope > div > [aria-hidden="true"]')
			.first()
			.evaluate((element) => {
				const { width, height } = element.getBoundingClientRect();
				return { width, height };
			});
		expect(skeletonColumnCount).toBeGreaterThan(1);
		expect(
			await getVisibleSkeletonItemCount(skeletonGrid),
		).toBeGreaterThanOrEqual(skeletonColumnCount);
		await expect(
			page.getByText("APIの応答を待っています...", { exact: true }),
		).toBeVisible();

		releaseRequest();
		await expect(
			page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
		).toBeVisible();
		const firstRowItems = await page
			.locator("[data-media-id]")
			.evaluateAll((items) => {
				const top = items[0]?.getBoundingClientRect().top;
				return items.filter((item) => item.getBoundingClientRect().top === top)
					.length;
			});
		expect(firstRowItems).toBe(skeletonColumnCount);
		const tile = await page
			.locator("[data-media-grid] [data-media-id]")
			.first()
			.evaluate((element) => {
				const { width, height } = element.getBoundingClientRect();
				return { width, height };
			});
		expect(Math.abs(tile.width - placeholder.width)).toBeLessThan(1);
		expect(Math.abs(tile.height - placeholder.height)).toBeLessThan(1);
		await expect(screenSkeleton).toHaveCount(0);
	});

	test("keeps existing results and form input during a background refresh", async ({
		page,
	}) => {
		let holdBackgroundRequest = false;
		let releaseRequest: () => void = () => {};
		const backgroundGate = new Promise<void>((resolve) => {
			releaseRequest = resolve;
		});
		await page.route(searchEndpoint, async (route) => {
			if (holdBackgroundRequest) {
				await backgroundGate;
			}
			await route.continue();
		});

		await page.goto("/search");
		await waitForAppHydration(page);
		const primaryLink = page.getByRole("link", {
			name: new RegExp(E2E_PRIMARY_FILE_NAME),
		});
		await expect(primaryLink).toBeVisible();

		holdBackgroundRequest = true;
		const searchInput = page.getByRole("combobox", {
			name: "メディアを検索",
			exact: true,
		});
		await primaryLink.evaluate((element) => {
			element.setAttribute("data-existing-result", "true");
		});
		await searchInput.fill(E2E_PRIMARY_FILE_NAME);
		await searchInput.press("Enter");
		await searchInput.fill("unsent draft");
		await expect(
			page.getByText("検索結果を更新中...", { exact: true }),
		).toBeVisible();
		await expect(searchInput).toHaveValue("unsent draft");
		await expect(searchInput).toBeFocused();
		await expect(primaryLink).toBeVisible();
		await expect(page.locator('[data-existing-result="true"]')).toBeVisible();
		await expect(page.locator("[data-screen-skeleton]")).toHaveCount(0);

		releaseRequest();
		await expect(
			page.getByText("検索結果を更新中...", { exact: true }),
		).toHaveCount(0);
		await expect(searchInput).toHaveValue("unsent draft");
		await expect(searchInput).toBeFocused();
		await expect(primaryLink).toBeVisible();
	});

	test("keeps the shell and detail skeleton visible while SPA media-detail data is delayed", async ({
		page,
	}) => {
		let releaseRequest: () => void = () => {};
		let markRequestSeen: () => void = () => {};
		const requestGate = new Promise<void>((resolve) => {
			releaseRequest = resolve;
		});
		const requestSeen = new Promise<void>((resolve) => {
			markRequestSeen = resolve;
		});
		await page.route(mediaDetailsEndpoint, async (route) => {
			markRequestSeen();
			await requestGate;
			await route.continue();
		});

		await page.goto(sourcePath());
		await waitForAppHydration(page);
		const mediaLink = page.getByRole("link", {
			name: new RegExp(E2E_PRIMARY_FILE_NAME),
		});
		await expect(mediaLink).toBeVisible();

		const navigation = mediaLink.dblclick();
		await requestSeen;
		await expect(
			page.getByRole("link", { name: "ライブラリ", exact: true }),
		).toBeVisible();
		await expect(page.locator('[data-skeleton="media-detail"]')).toBeVisible();

		releaseRequest();
		await navigation;
		await expect(
			page.getByRole("heading", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
		).toBeVisible();
	});

	test("recovers a SPA media-detail error with the keyboard retry action", async ({
		page,
		browserHealth,
	}) => {
		browserHealth.allowResponseFailure(apiPathPattern("media/getDetails"));
		browserHealth.allowConsole(
			"Failed to load resource: the server responded with a status of 503",
		);
		await page.route(mediaDetailsEndpoint, (route) =>
			route.fulfill({
				status: 503,
				contentType: "text/plain",
				body: "Service Unavailable",
			}),
		);

		await page.goto(sourcePath());
		await waitForAppHydration(page);
		await page
			.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) })
			.dblclick();
		await expect(page).toHaveURL(new RegExp(`${mediaPath()}/?$`));
		await expect(
			page.getByRole("link", { name: "ライブラリ", exact: true }),
		).toBeVisible();
		await expect(page.getByRole("alert")).toContainText(
			"メディア情報を読み込めませんでした",
		);

		await page.unroute(mediaDetailsEndpoint);
		const retryButton = page.getByRole("button", { name: "再試行" });
		await retryButton.focus();
		await expect(retryButton).toBeFocused();
		await retryButton.press("Enter");
		await expect(
			page.getByRole("heading", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
		).toBeVisible();
	});

	for (const failure of networkFailures) {
		test(`shows a recoverable error when search ${failure.name}`, async ({
			page,
			browserHealth,
		}) => {
			browserHealth.allowRequestFailure(apiPathPattern("media/search"));
			browserHealth.allowConsole(failure.consoleMessage);
			await page.route(searchEndpoint, (route) =>
				route.abort(failure.errorCode),
			);

			await openLibraryFromAbout(page);
			await expect(
				page.getByText("検索結果を取得できませんでした", { exact: true }),
			).toBeVisible();

			await page.unroute(searchEndpoint);
			await page.getByRole("button", { name: "再試行" }).click();
			await expect(
				page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
			).toBeVisible();
		});
	}

	test("shows a recoverable error when the search service rejects the request", async ({
		page,
		browserHealth,
	}) => {
		browserHealth.allowResponseFailure(apiPathPattern("media/search"));
		browserHealth.allowConsole(
			"Failed to load resource: the server responded with a status of 503",
		);
		await page.route(searchEndpoint, (route) =>
			route.fulfill({
				status: 503,
				contentType: "text/plain",
				body: "Service Unavailable",
			}),
		);

		await openLibraryFromAbout(page);
		await expect(
			page.getByText("検索結果を取得できませんでした", { exact: true }),
		).toBeVisible();

		await page.unroute(searchEndpoint);
		await page.getByRole("button", { name: "再試行" }).click();
		await expect(
			page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
		).toBeVisible();
	});

	test("shows the shared empty state for an unmatched search", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1600, height: 900 });
		await page.goto("/search");
		await waitForAppHydration(page);
		const searchInput = page.getByRole("combobox", {
			name: "メディアを検索",
			exact: true,
		});
		await searchInput.fill("__issue_579_no_matching_media__");
		await searchInput.press("Enter");

		const emptyState = page.locator('[data-state-ui="empty"]');
		await expect(emptyState).toBeVisible();
		await expect(emptyState).toContainText("検索結果が見つかりませんでした");
		await expect(emptyState.locator('[role="alert"]')).toHaveCount(0);
		await expect(
			page.getByRole("complementary", { name: "選択中のメディア" }),
		).toHaveCount(0);
		await emptyState.getByRole("button", { name: "検索条件をクリア" }).click();
		await expect(
			page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
		).toBeVisible();
	});

	test("opens the source form from an unconfigured library", async ({
		page,
	}) => {
		await routeApi(page, "sources/list", (route) =>
			route.fulfill({ json: [] }),
		);
		await page.route(searchEndpoint, (route) =>
			route.fulfill({ json: { media: [], total: 0 } }),
		);
		// The standalone route does not prime the server's source query. Navigate
		// within the browser so the mock supplies the first source response.
		await page.goto("/design-lab");
		await waitForAppHydration(page);
		await page.evaluate(() => history.pushState(history.state, "", "/search"));
		const emptyState = page.locator('#main-content [data-state-ui="empty"]');
		await expect(
			emptyState.getByRole("heading", { name: "ソースはまだありません" }),
		).toBeVisible();
		await emptyState.getByRole("button", { name: "ソースを追加" }).click();
		await expect(
			page.getByRole("dialog").getByRole("heading", { name: "ソースを追加" }),
		).toBeVisible();
	});

	test("offers the file chooser when a source is empty after reload", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1600, height: 900 });
		const directory = await mkdtemp(join(getE2eRuntimeDir(), "empty-source-"));
		const created = await apiRequest(page.request, "sources/create", {
			name: "Empty source",
			description: null,
			type: "local",
			connectionInfo: { path: directory },
		});
		await expect(created).toBeOK();
		const { id } = mediaSourceInfoSchema.parse(await created.json());
		if (!id) throw new Error("Source ID missing");
		try {
			await page.goto(`/sources/${id}`);
			const emptyState = page.locator('#main-content [data-state-ui="empty"]');
			const addMedia = emptyState.getByRole("button", {
				name: "追加",
				exact: true,
			});
			await expect(addMedia).toBeVisible();
			await page.reload();
			await expect(
				emptyState.getByRole("heading", {
					name: "このソースにはまだメディアがありません",
				}),
			).toBeVisible();
			await expect(
				page.getByRole("complementary", { name: "選択中のメディア" }),
			).toHaveCount(0);
			await waitForAppHydration(page);
			const fileChooser = page.waitForEvent("filechooser");
			await addMedia.click();
			await fileChooser;
		} finally {
			const deleted = await apiRequest(page.request, "sources/delete", { id });
			await expect(deleted).toBeOK();
		}
	});

	test("preserves existing content offline and completes the queued search after reconnecting", async ({
		page,
		context,
		browserHealth,
	}) => {
		await page.goto("/search");
		await waitForAppHydration(page);
		await expect(
			page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
		).toBeVisible();

		browserHealth.allowConsole("net::ERR_INTERNET_DISCONNECTED");
		browserHealth.allowRequestFailure(
			/\/api\/(?:media\/search|sources\/[^/]+\/events|jobs\/events|search-snapshots)(?:\?|$)/,
			"net::ERR_INTERNET_DISCONNECTED",
		);
		// Lazy thumbnails may start while the browser is deliberately offline.
		browserHealth.allowRequestFailure(
			apiPathPattern("media/getThumbnail"),
			"net::ERR_INTERNET_DISCONNECTED",
		);
		await context.setOffline(true);
		await expect(
			page.getByText(
				"APIに接続できません。ネットワーク接続を確認してください。",
				{ exact: true },
			),
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
		).toBeVisible();

		const searchInput = page.getByRole("combobox", {
			name: "メディアを検索",
			exact: true,
		});
		await searchInput.fill(E2E_PRIMARY_FILE_NAME);
		await searchInput.press("Enter");
		await expect(
			page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
		).toBeVisible();
		const recoveredSearch = page.waitForResponse(
			(response) =>
				new URL(response.url()).pathname === "/api/media/search" &&
				response.ok(),
		);
		await context.setOffline(false);
		await recoveredSearch;
		await expect(page.getByText("1件", { exact: true })).toBeVisible();
		await expect(
			page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
		).toBeVisible();
		await expect(
			page.getByText(
				"APIに接続できません。ネットワーク接続を確認してください。",
				{ exact: true },
			),
		).toHaveCount(0);
	});
});
