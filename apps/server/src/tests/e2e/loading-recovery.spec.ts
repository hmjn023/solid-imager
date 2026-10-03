import type { Locator, Page } from "@playwright/test";
import {
	E2E_PRIMARY_FILE_NAME,
	mediaPath,
	sourcePath,
} from "./support/fixture";
import { expect, test } from "./support/test";

const searchEndpoint = /\/api\/rpc\/media\/search(?:\?|$)/;
const mediaDetailsEndpoint = /\/api\/rpc\/media\/getDetails(?:\?|$)/;
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

test.describe("loading and recovery", () => {
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

		const navigation = page.goto("/search", { waitUntil: "commit" });
		await expect(
			page.getByRole("link", { name: "Library", exact: true }),
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
		expect(skeletonColumnCount).toBeGreaterThan(1);
		expect(
			await getVisibleSkeletonItemCount(skeletonGrid),
		).toBeGreaterThanOrEqual(skeletonColumnCount);
		await expect(
			page.getByText("APIの応答を待っています...", { exact: true }),
		).toBeVisible();

		releaseRequest();
		await navigation;
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
		const mediaLink = page.getByRole("link", {
			name: new RegExp(E2E_PRIMARY_FILE_NAME),
		});
		await expect(mediaLink).toBeVisible();

		const navigation = mediaLink.dblclick();
		await requestSeen;
		await expect(
			page.getByRole("link", { name: "Library", exact: true }),
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
		browserHealth.allowResponseFailure("/api/rpc/media/getDetails");
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
		await page
			.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) })
			.dblclick();
		await expect(page).toHaveURL(new RegExp(`${mediaPath()}/?$`));
		await expect(
			page.getByRole("link", { name: "Library", exact: true }),
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
			browserHealth.allowRequestFailure("/api/rpc/media/search");
			browserHealth.allowConsole(failure.consoleMessage);
			await page.route(searchEndpoint, (route) =>
				route.abort(failure.errorCode),
			);

			await page.goto("/search");
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
		browserHealth.allowResponseFailure("/api/rpc/media/search");
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

		await page.goto("/search");
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
		await page.goto("/search");
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
	});

	test("preserves existing content offline and completes the queued search after reconnecting", async ({
		page,
		context,
		browserHealth,
	}) => {
		await page.goto("/search");
		await expect(
			page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
		).toBeVisible();

		browserHealth.allowConsole("net::ERR_INTERNET_DISCONNECTED");
		browserHealth.allowRequestFailure(
			/\/api\/rpc\/(?:media\/search|sources\/events|jobs\/events|searchSnapshots\/capture)(?:\?|$)/,
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
				new URL(response.url()).pathname === "/api/rpc/media/search" &&
				response.ok(),
		);
		await context.setOffline(false);
		await recoveredSearch;
		await expect(page.getByText("1 items", { exact: true })).toBeVisible();
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
