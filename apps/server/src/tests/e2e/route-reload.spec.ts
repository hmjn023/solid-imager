import {
	E2E_PRIMARY_FILE_NAME,
	E2E_SOURCE_ID,
	mediaPath,
	sourcePath,
} from "./support/fixture";
import { expect, expectRouteHealthy, test } from "./support/test";

const routeErrorMarkup = [
	"画面を読み込んでいます...",
	"画面を表示できませんでした",
	"[object Object]",
];
const INITIAL_CONTENT_BUDGET_MS = 12_000;
const SPA_CONTENT_BUDGET_MS = 5_000;

async function expectSsrHtmlHealthy(
	page: import("@playwright/test").Page,
	path: string,
	staticFallbackText?: string,
): Promise<void> {
	const response = await page.request.get(path);
	expect(response.status()).toBeLessThan(500);
	const html = await response.text();
	// Client-only route bodies may defer their data, but the App Shell itself
	// must still be server-rendered so a cold navigation is never a blank page.
	expect(html).toContain("Home");
	if (staticFallbackText) {
		expect(html).toContain(staticFallbackText);
	}
	for (const markup of routeErrorMarkup) {
		expect(html).not.toContain(markup);
	}
}

type RouteCase = {
	name: string;
	path: string;
	heading: string;
	apiEndpoint?: string;
	readyMediaLink?: string;
	staticFallbackText?: string;
};

const routeCases: readonly RouteCase[] = [
	{
		name: "global search",
		path: "/search",
		heading: "メディア検索",
		apiEndpoint: "/api/rpc/media/search",
		readyMediaLink: E2E_PRIMARY_FILE_NAME,
	},
	{
		name: "settings",
		path: "/config",
		heading: "Settings",
		apiEndpoint: "/api/rpc/config/get",
	},
	{
		name: "entity manager",
		path: "/manager",
		heading: "Entity Manager",
	},
	{
		name: "media sources",
		path: "/sources",
		heading: "Media Sources",
	},
	{
		name: "seeded source",
		path: sourcePath(),
		heading: `Media in Source: ${E2E_SOURCE_ID}`,
	},
	{
		name: "seeded media detail",
		path: mediaPath(),
		heading: E2E_PRIMARY_FILE_NAME,
		staticFallbackText: "メディア詳細を準備しています...",
	},
];

test.describe("direct navigation and reload", () => {
	for (const routeCase of routeCases) {
		test(`${routeCase.name} renders after direct navigation and reload`, async ({
			page,
			browserHealth,
		}) => {
			await expectSsrHtmlHealthy(
				page,
				routeCase.path,
				routeCase.staticFallbackText,
			);
			const directNavigationStartedAt = Date.now();
			const response = await page.goto(routeCase.path);
			expect(response?.ok()).toBeTruthy();
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
			const directNavigationElapsedMs = Date.now() - directNavigationStartedAt;
			browserHealth.recordContentReady(
				`${routeCase.name} direct navigation`,
				directNavigationElapsedMs,
			);
			expect(directNavigationElapsedMs).toBeLessThan(INITIAL_CONTENT_BUDGET_MS);
			await expectRouteHealthy(page);
			const apiRequestsBeforeReload = routeCase.apiEndpoint
				? browserHealth.apiRequestCount(routeCase.apiEndpoint)
				: 0;
			if (routeCase.apiEndpoint) {
				expect(
					apiRequestsBeforeReload,
					`API requests: ${JSON.stringify(browserHealth.apiRequests())}`,
				).toBe(1);
			}

			const reloadStartedAt = Date.now();
			const reloadResponse = await page.reload();
			expect(reloadResponse?.ok()).toBeTruthy();
			if (!reloadResponse) {
				throw new Error(
					`Reload did not receive a response for ${routeCase.path}`,
				);
			}
			const reloadHtml = await reloadResponse.text();
			expect(reloadHtml).toContain("Home");
			if (routeCase.staticFallbackText) {
				expect(reloadHtml).toContain(routeCase.staticFallbackText);
			}
			for (const markup of routeErrorMarkup) {
				expect(reloadHtml).not.toContain(markup);
			}
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
			const reloadElapsedMs = Date.now() - reloadStartedAt;
			browserHealth.recordContentReady(
				`${routeCase.name} reload`,
				reloadElapsedMs,
			);
			expect(reloadElapsedMs).toBeLessThan(INITIAL_CONTENT_BUDGET_MS);
			if (routeCase.apiEndpoint) {
				expect(
					browserHealth.apiRequestCount(routeCase.apiEndpoint) -
						apiRequestsBeforeReload,
					`API requests: ${JSON.stringify(browserHealth.apiRequests())}`,
				).toBe(1);
			}
			await expectRouteHealthy(page);
		});
	}
});

test("SPA navigation renders the next route without a route error", async ({
	page,
	browserHealth,
}) => {
	await page.goto("/");
	const searchNavigationStartedAt = Date.now();
	await page.getByRole("link", { name: "Search", exact: true }).click();
	await expect(page).toHaveURL(/\/search$/);
	await expect(
		page.getByRole("heading", { name: "メディア検索", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible();
	const searchNavigationElapsedMs = Date.now() - searchNavigationStartedAt;
	browserHealth.recordContentReady(
		"search SPA navigation",
		searchNavigationElapsedMs,
	);
	expect(searchNavigationElapsedMs).toBeLessThan(SPA_CONTENT_BUDGET_MS);
	await expectRouteHealthy(page);

	const sourcesNavigationStartedAt = Date.now();
	await page.getByRole("link", { name: "Sources", exact: true }).click();
	await expect(page).toHaveURL(/\/sources\/?$/);
	await expect(
		page.getByRole("heading", { name: "Media Sources", exact: true }),
	).toBeVisible();
	const sourcesNavigationElapsedMs = Date.now() - sourcesNavigationStartedAt;
	browserHealth.recordContentReady(
		"sources SPA navigation",
		sourcesNavigationElapsedMs,
	);
	expect(sourcesNavigationElapsedMs).toBeLessThan(SPA_CONTENT_BUDGET_MS);
	await expectRouteHealthy(page);
});
