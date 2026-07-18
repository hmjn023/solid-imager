import type { Page } from "@playwright/test";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_SOURCE_ID,
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
const TTFB_BUDGET_MS = isProduction ? 1_000 : 1_500;
const SPA_CONTENT_BUDGET_MS = isProduction ? 1_500 : 3_000;

const searchFilterEndpoints = [
	"/api/rpc/tags/list",
	"/api/rpc/sources/list",
	"/api/rpc/projects/list",
	"/api/rpc/ips/list",
	"/api/rpc/characters/list",
	"/api/rpc/authors/list",
] as const;

const sourceMediaFilterEndpoints = [
	"/api/rpc/tags/list",
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

async function expectSsrHtmlHealthy(
	response: { status(): number; text(): Promise<string> },
	expectedSsrText: string,
	expectedSsrMarkup?: string,
): Promise<void> {
	expect(response.status()).toBeLessThan(500);
	const html = await response.text();
	expect(html).toContain("Home");
	expect(html).toContain(expectedSsrText);
	if (expectedSsrMarkup) {
		expect(html).toContain(expectedSsrMarkup);
	}
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
	ssrText: string;
	ssrMarkup?: string;
	hydratedEndpoints: readonly string[];
	clientEndpoints?: readonly string[];
	readyMediaLink?: string;
	readyButton?: string;
	seedSearchSession?: boolean;
	directBudgetMs: number;
	reloadBudgetMs: number;
};

const routeCases: readonly RouteCase[] = [
	{
		name: "global search",
		path: "/search",
		heading: "メディア検索",
		ssrText: "検索画面を準備しています...",
		hydratedEndpoints: searchFilterEndpoints,
		clientEndpoints: ["/api/rpc/media/search", "/api/rpc/presets/list"],
		readyMediaLink: E2E_PRIMARY_FILE_NAME,
		seedSearchSession: true,
		directBudgetMs: isProduction ? 1_500 : 5_000,
		reloadBudgetMs: isProduction ? 1_000 : 2_000,
	},
	{
		name: "settings",
		path: "/config",
		heading: "Settings",
		ssrText: "Save Changes",
		hydratedEndpoints: ["/api/rpc/config/get"],
		readyButton: "Save Changes",
		directBudgetMs: isProduction ? 1_500 : 2_500,
		reloadBudgetMs: isProduction ? 1_500 : 2_000,
	},
	{
		name: "entity manager",
		path: "/manager",
		heading: "Entity Manager",
		ssrText: "管理データを準備しています...",
		hydratedEndpoints: [
			"/api/rpc/projects/list",
			"/api/rpc/ips/list",
			"/api/rpc/characters/list",
			"/api/rpc/sources/list",
		],
		readyButton: "Create New",
		directBudgetMs: isProduction ? 1_500 : 3_000,
		reloadBudgetMs: isProduction ? 1_500 : 2_000,
	},
	{
		name: "media sources",
		path: "/sources",
		heading: "Media Sources",
		ssrText: E2E_SOURCE_NAME,
		ssrMarkup: 'data-testid="source-card"',
		hydratedEndpoints: ["/api/rpc/sources/list"],
		directBudgetMs: isProduction ? 1_500 : 2_500,
		reloadBudgetMs: isProduction ? 1_500 : 2_000,
	},
	{
		name: "seeded source",
		path: sourcePath(),
		heading: `Media in Source: ${E2E_SOURCE_ID}`,
		ssrText: "メディア一覧を準備しています...",
		hydratedEndpoints: sourceMediaFilterEndpoints,
		clientEndpoints: ["/api/rpc/media/search"],
		directBudgetMs: isProduction ? 1_500 : 3_000,
		reloadBudgetMs: isProduction ? 1_000 : 2_000,
	},
	{
		name: "seeded media detail",
		path: mediaPath(),
		heading: E2E_PRIMARY_FILE_NAME,
		ssrText: "メディア詳細を準備しています...",
		hydratedEndpoints: mediaDetailHydratedEndpoints,
		directBudgetMs: isProduction ? 1_500 : 4_000,
		reloadBudgetMs: isProduction ? 1_000 : 2_000,
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
			await expectSsrHtmlHealthy(
				response,
				routeCase.ssrText,
				routeCase.ssrMarkup,
			);
			await expect(
				page.getByRole("heading", { name: routeCase.heading, exact: true }),
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
			for (const endpoint of routeCase.hydratedEndpoints) {
				expect(
					browserHealth.apiRequestCountPathSince(
						directRequestCheckpoint,
						endpoint,
					),
					`Hydrated query refetched in browser: ${endpoint}`,
				).toBe(0);
			}
			for (const endpoint of routeCase.clientEndpoints ?? []) {
				expect(
					browserHealth.apiRequestCountPathSince(
						directRequestCheckpoint,
						endpoint,
					),
					`Client query request budget exceeded: ${endpoint}`,
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
			await expectSsrHtmlHealthy(
				reloadResponse,
				routeCase.ssrText,
				routeCase.ssrMarkup,
			);
			await expect(
				page.getByRole("heading", { name: routeCase.heading, exact: true }),
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
			for (const endpoint of routeCase.hydratedEndpoints) {
				expect(
					browserHealth.apiRequestCountPathSince(
						reloadRequestCheckpoint,
						endpoint,
					),
					`Hydrated query refetched after reload: ${endpoint}`,
				).toBe(0);
			}
			for (const endpoint of routeCase.clientEndpoints ?? []) {
				expect(
					browserHealth.apiRequestCountPathSince(
						reloadRequestCheckpoint,
						endpoint,
					),
					`Client query reload budget exceeded: ${endpoint}`,
				).toBe(1);
			}
			await expectRouteHealthy(page);
		});
	}
});

test("full data SSR routes become interactive after hydration", async ({
	page,
}) => {
	await page.goto("/config");
	await expect(
		page.getByRole("heading", { name: "Settings", exact: true }),
	).toBeVisible();
	await waitForAppHydration(page);
	await page.getByRole("tab", { name: "AI", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "AI Service", exact: true }),
	).toBeVisible();

	await page.goto("/sources");
	await expect(
		page.getByRole("heading", { name: "Media Sources", exact: true }),
	).toBeVisible();
	await waitForAppHydration(page);
	await page.getByRole("button", { name: "Add Source", exact: true }).click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("SPA intent prefetch and cache revisit do not duplicate route queries", async ({
	page,
	browserHealth,
}) => {
	await page.goto("/");
	await waitForAppHydration(page);

	const searchCheckpoint = browserHealth.requestCheckpoint();
	const searchLink = page.getByRole("link", { name: "Search", exact: true });
	const intentFilterResponse = page.waitForResponse((response) => {
		const url = new URL(response.url());
		return url.pathname === "/api/rpc/tags/list" && response.ok();
	});
	await searchLink.hover();
	await intentFilterResponse;
	await expect(page).toHaveURL(/\/$/);
	expect(
		browserHealth.apiRequestCountPathSince(
			searchCheckpoint,
			"/api/rpc/tags/list",
		),
	).toBe(1);

	const searchNavigationStartedAt = Date.now();
	await searchLink.click();
	await expect(page).toHaveURL(/\/search$/);
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

	const sourcesCheckpoint = browserHealth.requestCheckpoint();
	const sourcesNavigationStartedAt = Date.now();
	await page.getByRole("link", { name: "Sources", exact: true }).click();
	await expect(page).toHaveURL(/\/sources\/?$/);
	await expect(
		page.getByRole("heading", { name: "Media Sources", exact: true }),
	).toBeVisible();
	await waitForAppHydration(page);
	const sourcesNavigationElapsedMs = Date.now() - sourcesNavigationStartedAt;
	browserHealth.recordNavigation(
		"sources SPA navigation",
		sourcesNavigationElapsedMs,
		sourcesCheckpoint,
	);
	expect(sourcesNavigationElapsedMs).toBeLessThan(SPA_CONTENT_BUDGET_MS);
	expect(
		browserHealth.apiRequestCountPathSince(
			sourcesCheckpoint,
			"/api/rpc/sources/list",
		),
	).toBe(0);
	await expectRouteHealthy(page);

	const sourceMediaCheckpoint = browserHealth.requestCheckpoint();
	const sourceMediaNavigationStartedAt = Date.now();
	await page.getByTestId("source-card").click();
	await expect(page).toHaveURL(new RegExp(`${sourcePath()}/?$`));
	await expect(
		page.getByRole("heading", {
			name: `Media in Source: ${E2E_SOURCE_ID}`,
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
	await page.getByRole("link", { name: "Search", exact: true }).hover();
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
	await page.getByRole("link", { name: "Search", exact: true }).click();
	await expect(page).toHaveURL(/\/search$/);
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
	expect(
		browserHealth.apiRequestCountPathSince(
			searchCheckpoint,
			"/api/rpc/sources/events",
		),
		"Source event subscriptions must be shared across cached routes",
	).toBeLessThanOrEqual(3);
	await expectRouteHealthy(page);
});
