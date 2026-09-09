import type { Page } from "@playwright/test";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_SOURCE_NAME,
	mediaPath,
	sourcePath,
} from "./support/fixture";
import {
	expect,
	expectRouteHealthy,
	test,
	waitForAppHydration,
} from "./support/test";

const routeErrorMarkup = [
	"画面を読み込んでいます...",
	"画面を表示できませんでした",
	"[object Object]",
];
const isProduction = process.env.E2E_MODE === "production";
const DEV_TTFB_BUDGET_MS = 12_000;
const DEV_RELOAD_NAVIGATION_BUDGET_MS = 5_000;
const TTFB_BUDGET_MS = isProduction ? 1_000 : DEV_TTFB_BUDGET_MS;
const SPA_CONTENT_BUDGET_MS = isProduction ? 1_500 : 6_000;
// The first browser navigation in Vite dev mode also compiles the route's
// client graph. Keep the performance guard strict for production while
// allowing that one-time development cost.
const DEV_DIRECT_NAVIGATION_BUDGET_MS = 20_000;

const searchFilterEndpoints = [
	"/api/rpc/tags/list",
	"/api/rpc/sources/list",
	"/api/rpc/projects/list",
	"/api/rpc/ips/list",
	"/api/rpc/characters/list",
	"/api/rpc/authors/list",
] as const;

const mediaDetailHydratedEndpoints = [
	"/api/rpc/media/getDetails",
	"/api/rpc/projects/listForMedia",
	"/api/rpc/projects/list",
	"/api/rpc/ips/list",
	"/api/rpc/characters/list",
] as const;

async function expectSsrHtmlHealthy(response: {
	status(): number;
	text(): Promise<string>;
}): Promise<void> {
	expect(response.status()).toBeLessThan(500);
	const html = await response.text();
	for (const markup of routeErrorMarkup) {
		expect(html).not.toContain(markup);
	}
}

async function expectTtfbWithinBudget(page: Page): Promise<void> {
	const responseStartMs = await page.evaluate(() => {
		const navigation = performance.getEntriesByType("navigation").at(0) as
			| PerformanceNavigationTiming
			| undefined;
		return navigation?.responseStart ?? Number.POSITIVE_INFINITY;
	});
	expect(responseStartMs).toBeLessThan(TTFB_BUDGET_MS);
}

type RouteCase = {
	name: string;
	path: string;
	heading: string;
	readyMediaLink?: string;
	readyButton?: string;
	clientEndpoints?: readonly string[];
	seedSearchSession?: boolean;
	directBudgetMs: number;
	reloadBudgetMs: number;
};

const routeCases: readonly RouteCase[] = [
	{
		name: "global search",
		path: "/search",
		heading: "すべてのメディア",
		readyMediaLink: E2E_PRIMARY_FILE_NAME,
		seedSearchSession: true,
		clientEndpoints: ["/api/rpc/media/search"],
		directBudgetMs: isProduction ? 1_500 : DEV_DIRECT_NAVIGATION_BUDGET_MS,
		reloadBudgetMs: isProduction ? 1_000 : DEV_RELOAD_NAVIGATION_BUDGET_MS,
	},
	{
		name: "settings",
		path: "/config",
		heading: "Settings",
		clientEndpoints: ["/api/rpc/config/get"],
		directBudgetMs: isProduction ? 1_500 : DEV_DIRECT_NAVIGATION_BUDGET_MS,
		reloadBudgetMs: isProduction ? 1_500 : DEV_RELOAD_NAVIGATION_BUDGET_MS,
	},
	{
		name: "entity manager",
		path: "/manager",
		heading: "Manager",
		directBudgetMs: isProduction ? 1_500 : DEV_DIRECT_NAVIGATION_BUDGET_MS,
		reloadBudgetMs: isProduction ? 1_500 : DEV_RELOAD_NAVIGATION_BUDGET_MS,
	},
	{
		name: "seeded source",
		path: sourcePath(),
		heading: E2E_SOURCE_NAME,
		directBudgetMs: isProduction ? 1_500 : DEV_DIRECT_NAVIGATION_BUDGET_MS,
		reloadBudgetMs: isProduction ? 1_000 : DEV_RELOAD_NAVIGATION_BUDGET_MS,
	},
	{
		name: "seeded media detail",
		path: mediaPath(),
		heading: E2E_PRIMARY_FILE_NAME,
		directBudgetMs: isProduction ? 1_500 : DEV_DIRECT_NAVIGATION_BUDGET_MS,
		reloadBudgetMs: isProduction ? 1_000 : DEV_RELOAD_NAVIGATION_BUDGET_MS,
	},
];

test.describe("direct navigation and reload", () => {
	for (const routeCase of routeCases) {
		test(`${routeCase.name} renders after direct navigation and reload`, async ({
			page,
			browserHealth,
		}) => {
			if (routeCase.seedSearchSession) {
				await page.addInitScript((fileName) => {
					sessionStorage.setItem(
						"current-all",
						JSON.stringify({
							mode: "simple",
							selectedSource: "",
							value: {
								type: "group",
								operator: "and",
								children: [
									{
										type: "criterion",
										target: "keyword",
										operator: "contains",
										value: fileName,
									},
								],
							},
							sort: "date",
							order: "desc",
						}),
					);
				}, E2E_PRIMARY_FILE_NAME);
			}

			const directRequestCheckpoint = browserHealth.requestCheckpoint();
			const directNavigationStartedAt = Date.now();
			const response = await page.goto(routeCase.path);
			expect(response?.ok()).toBeTruthy();
			if (!response) {
				throw new Error(
					`Direct navigation did not receive a response for ${routeCase.path}`,
				);
			}
			await expectSsrHtmlHealthy(response);
			await expect(
				page
					.locator("#v2-main-content")
					.getByText(routeCase.heading, { exact: true })
					.first(),
			).toBeVisible();
			if (routeCase.readyMediaLink) {
				await expect(
					page.getByRole("link", {
						name: new RegExp(routeCase.readyMediaLink),
					}),
				).toBeVisible();
			}
			if (routeCase.readyButton) {
				await expect(
					page.getByRole("button", {
						name: routeCase.readyButton,
						exact: true,
					}),
				).toBeVisible();
			}
			await waitForAppHydration(page);
			const directNavigationElapsedMs = Date.now() - directNavigationStartedAt;
			browserHealth.recordNavigation(
				`${routeCase.name} direct navigation`,
				directNavigationElapsedMs,
				directRequestCheckpoint,
			);
			expect(directNavigationElapsedMs).toBeLessThan(routeCase.directBudgetMs);
			await expectTtfbWithinBudget(page);
			for (const endpoint of routeCase.clientEndpoints ?? []) {
				expect(
					browserHealth.apiRequestCountPathSince(
						directRequestCheckpoint,
						endpoint,
					),
					`Direct navigation should request ${endpoint} once`,
				).toBe(1);
			}
			await expectRouteHealthy(page);

			const reloadRequestCheckpoint = browserHealth.requestCheckpoint();
			const reloadStartedAt = Date.now();
			const reloadResponse = await page.reload();
			expect(reloadResponse?.ok()).toBeTruthy();
			if (!reloadResponse) {
				throw new Error(
					`Reload did not receive a response for ${routeCase.path}`,
				);
			}
			await expectSsrHtmlHealthy(reloadResponse);
			await expect(
				page
					.locator("#v2-main-content")
					.getByText(routeCase.heading, { exact: true })
					.first(),
			).toBeVisible();
			if (routeCase.readyMediaLink) {
				await expect(
					page.getByRole("link", {
						name: new RegExp(routeCase.readyMediaLink),
					}),
				).toBeVisible();
			}
			if (routeCase.readyButton) {
				await expect(
					page.getByRole("button", {
						name: routeCase.readyButton,
						exact: true,
					}),
				).toBeVisible();
			}
			await waitForAppHydration(page);
			const reloadElapsedMs = Date.now() - reloadStartedAt;
			browserHealth.recordNavigation(
				`${routeCase.name} reload`,
				reloadElapsedMs,
				reloadRequestCheckpoint,
			);
			expect(reloadElapsedMs).toBeLessThan(routeCase.reloadBudgetMs);
			await expectTtfbWithinBudget(page);
			for (const endpoint of routeCase.clientEndpoints ?? []) {
				expect(
					browserHealth.apiRequestCountPathSince(
						reloadRequestCheckpoint,
						endpoint,
					),
					`Reload should request ${endpoint} once`,
				).toBe(1);
			}
			await expectRouteHealthy(page);
		});
	}
});

test("canonical pages become interactive after hydration", async ({ page }) => {
	await page.goto("/config");
	await expect(
		page.getByRole("heading", { name: "Settings", exact: true }),
	).toBeVisible();
	await waitForAppHydration(page);

	await page.goto("/search");
	await expect(
		page
			.locator("#v2-main-content")
			.getByText("すべてのメディア", { exact: true })
			.first(),
	).toBeVisible();
	await waitForAppHydration(page);
	await expect(page.locator("[data-media-id]").first()).toBeVisible();
});

test("canonical navigation and cache revisit do not duplicate route queries", async ({
	page,
	browserHealth,
}) => {
	await page.goto("/");
	await waitForAppHydration(page);

	const searchCheckpoint = browserHealth.requestCheckpoint();
	await expect(page).toHaveURL(/\/search(?:\?.*)?$/);
	const searchLink = page.getByRole("link", { name: "Library", exact: true });
	await searchLink.hover();
	await expect(page).toHaveURL(/\/search(?:\?.*)?$/);
	expect(
		browserHealth.apiRequestCountPathSince(
			searchCheckpoint,
			"/api/rpc/tags/list",
		),
	).toBeLessThanOrEqual(1);

	const searchNavigationStartedAt = Date.now();
	await searchLink.click();
	await expect(page).toHaveURL(/\/search(?:\?.*)?$/);
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible();
	await waitForAppHydration(page);
	const searchNavigationElapsedMs = Date.now() - searchNavigationStartedAt;
	browserHealth.recordNavigation(
		"search SPA navigation",
		searchNavigationElapsedMs,
		searchCheckpoint,
	);
	expect(searchNavigationElapsedMs).toBeLessThan(SPA_CONTENT_BUDGET_MS);
	for (const endpoint of [...searchFilterEndpoints, "/api/rpc/media/search"]) {
		expect(
			browserHealth.apiRequestCountPathSince(searchCheckpoint, endpoint),
			`Search intent prefetch duplicated ${endpoint}`,
		).toBeLessThanOrEqual(1);
	}
	await expectRouteHealthy(page);

	const sourceMediaCheckpoint = browserHealth.requestCheckpoint();
	const sourceMediaNavigationStartedAt = Date.now();
	await page.getByRole("link", { name: new RegExp(E2E_SOURCE_NAME) }).click();
	await expect(page).toHaveURL(new RegExp(`${sourcePath()}/?$`));
	await expect(
		page.getByRole("heading", {
			name: E2E_SOURCE_NAME,
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible();
	await waitForAppHydration(page);
	const sourceMediaNavigationElapsedMs =
		Date.now() - sourceMediaNavigationStartedAt;
	browserHealth.recordNavigation(
		"source media SPA navigation",
		sourceMediaNavigationElapsedMs,
		sourceMediaCheckpoint,
	);
	expect(sourceMediaNavigationElapsedMs).toBeLessThan(SPA_CONTENT_BUDGET_MS);
	expect(
		browserHealth.apiRequestCountPathSince(
			sourceMediaCheckpoint,
			"/api/rpc/media/search",
		),
	).toBeLessThanOrEqual(1);
	await expectRouteHealthy(page);

	// Intent loaders must not mutate the shared search store while the user is
	// merely hovering a link from another search-backed route.
	const sourceSearchInput = page.getByPlaceholder("ファイル名を入力...");
	await sourceSearchInput.fill(E2E_PRIMARY_FILE_NAME);
	await page.getByRole("link", { name: "Library", exact: true }).hover();
	await page.waitForTimeout(300);
	await expect(sourceSearchInput).toHaveValue(E2E_PRIMARY_FILE_NAME);
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible();

	const detailCheckpoint = browserHealth.requestCheckpoint();
	const detailNavigationStartedAt = Date.now();
	await page
		.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) })
		.click();
	await expect(page).toHaveURL(new RegExp(`${mediaPath()}/?$`));
	await expect(
		page.getByRole("heading", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
	).toBeVisible();
	await waitForAppHydration(page);
	const detailNavigationElapsedMs = Date.now() - detailNavigationStartedAt;
	browserHealth.recordNavigation(
		"media detail SPA navigation",
		detailNavigationElapsedMs,
		detailCheckpoint,
	);
	expect(detailNavigationElapsedMs).toBeLessThan(SPA_CONTENT_BUDGET_MS);
	for (const endpoint of mediaDetailHydratedEndpoints) {
		expect(
			browserHealth.apiRequestCountPathSince(detailCheckpoint, endpoint),
			`Media detail intent prefetch duplicated ${endpoint}`,
		).toBeLessThanOrEqual(1);
	}
	await expectRouteHealthy(page);

	const revisitCheckpoint = browserHealth.requestCheckpoint();
	const revisitStartedAt = Date.now();
	await page.getByRole("link", { name: "Library", exact: true }).click();
	await expect(page).toHaveURL(/\/search(?:\?.*)?$/);
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible();
	await waitForAppHydration(page);
	const revisitElapsedMs = Date.now() - revisitStartedAt;
	browserHealth.recordNavigation(
		"search cache revisit",
		revisitElapsedMs,
		revisitCheckpoint,
	);
	expect(revisitElapsedMs).toBeLessThan(SPA_CONTENT_BUDGET_MS);
	expect(
		browserHealth.apiRequestCountPathSince(
			revisitCheckpoint,
			"/api/rpc/media/search",
		),
	).toBeLessThanOrEqual(1);
	const sourceEventRequestCount = browserHealth.apiRequestCountPathSince(
		searchCheckpoint,
		"/api/rpc/sources/events",
	);
	expect(sourceEventRequestCount).toBeGreaterThan(0);
	expect(
		sourceEventRequestCount,
		"Source event subscriptions must be shared across cached routes",
	).toBeLessThanOrEqual(3);
	await expectRouteHealthy(page);
});
