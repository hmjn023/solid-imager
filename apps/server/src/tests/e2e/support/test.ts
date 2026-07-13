import type { Page, Request } from "@playwright/test";
import { test as base, expect } from "@playwright/test";

type UrlMatcher = RegExp | string;

type BrowserHealth = {
	allowConsole: (matcher: UrlMatcher) => void;
	allowRequestFailure: (matcher: UrlMatcher) => void;
	allowResponseFailure: (matcher: UrlMatcher) => void;
	apiRequestCount: (matcher: UrlMatcher) => number;
	apiRequestCountPathSince: (checkpoint: number, pathname: string) => number;
	apiRequests: () => readonly string[];
	recordContentReady: (label: string, elapsedMs: number) => void;
	recordNavigation: (
		label: string,
		elapsedMs: number,
		requestCheckpoint: number,
	) => void;
	requestCheckpoint: () => number;
};

type BrowserPerformanceMetric = {
	url: string;
	firstContentfulPaintMs: number | null;
	navigation: {
		responseStartMs: number;
		domContentLoadedMs: number;
		loadMs: number;
		transferSize: number;
	} | null;
};

type ContentReadyMetric = {
	label: string;
	elapsedMs: number;
};

type NavigationMetric = ContentReadyMetric & {
	apiRequestCount: number;
	duplicateApiRequests: Array<{ request: string; count: number }>;
};

function summarizeRequests(urls: readonly string[]) {
	const counts = new Map<string, number>();
	for (const requestUrl of urls) {
		const url = new URL(requestUrl);
		counts.set(url.pathname, (counts.get(url.pathname) ?? 0) + 1);
	}
	return {
		apiRequestCount: urls.length,
		duplicateApiRequests: [...counts.entries()]
			.filter(([, count]) => count > 1)
			.map(([request, count]) => ({ request, count })),
	};
}

function matches(value: string, matchers: UrlMatcher[]): boolean {
	return matchers.some((matcher) =>
		typeof matcher === "string" ? value.includes(matcher) : matcher.test(value),
	);
}

export async function expectRouteHealthy(page: Page): Promise<void> {
	await expect(
		page.getByText("画面を表示できませんでした", { exact: true }),
	).toHaveCount(0);
	await expect(page.getByText("[object Object]", { exact: true })).toHaveCount(
		0,
	);
}

export async function waitForAppHydration(page: Page): Promise<void> {
	await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
	await page.evaluate(
		() =>
			new Promise<void>((resolve) => {
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
			}),
	);
}

async function collectPagePerformance(
	page: Page,
): Promise<BrowserPerformanceMetric> {
	return await page.evaluate(() => {
		const navigation = performance.getEntriesByType("navigation").at(0) as
			| PerformanceNavigationTiming
			| undefined;
		const firstContentfulPaint = performance
			.getEntriesByType("paint")
			.find((entry) => entry.name === "first-contentful-paint");

		return {
			url: window.location.href,
			firstContentfulPaintMs: firstContentfulPaint?.startTime ?? null,
			navigation: navigation
				? {
						responseStartMs: navigation.responseStart,
						domContentLoadedMs: navigation.domContentLoadedEventEnd,
						loadMs: navigation.loadEventEnd,
						transferSize: navigation.transferSize,
					}
				: null,
		};
	});
}

export const test = base.extend<{ browserHealth: BrowserHealth }>({
	browserHealth: [
		async ({ context, page }, use, testInfo) => {
			const failures: string[] = [];
			const allowedConsole: UrlMatcher[] = [];
			const allowedRequestFailures: UrlMatcher[] = [];
			const allowedResponseFailures: UrlMatcher[] = [];
			const apiRequestUrls: string[] = [];
			const apiRequestCounts = new Map<string, number>();
			const contentReadyMetrics: ContentReadyMetric[] = [];
			const navigationMetrics: NavigationMetric[] = [];
			const observedPages = new Set<Page>();

			const observePage = (target: Page) => {
				if (observedPages.has(target)) {
					return;
				}
				observedPages.add(target);
				let isClosing = false;
				let isNavigating = false;
				target.on("console", (message) => {
					if (message.type() !== "error" && message.type() !== "warning") {
						return;
					}
					const text = message.text();
					if (!matches(text, allowedConsole)) {
						failures.push(`console ${message.type()}: ${text}`);
					}
				});
				target.on("pageerror", (error) => {
					failures.push(`pageerror: ${error.stack ?? error.message}`);
				});
				const isMainFrameNavigation = (request: Request) =>
					request.isNavigationRequest() &&
					request.frame() === target.mainFrame();
				target.on("request", (request) => {
					if (isMainFrameNavigation(request)) {
						isNavigating = true;
					}
					const url = new URL(request.url());
					if (!url.pathname.startsWith("/api/")) {
						return;
					}
					apiRequestUrls.push(request.url());
					const key = `${request.method()} ${url.pathname}`;
					apiRequestCounts.set(key, (apiRequestCounts.get(key) ?? 0) + 1);
				});
				target.on("requestfailed", (request) => {
					const errorText = request.failure()?.errorText ?? null;
					// Browser navigation and page close legitimately abort both long-lived
					// streams and ordinary in-flight fetches. Keep aborts during an
					// otherwise stable page as a test failure.
					const isLifecycleRequestAbort =
						errorText?.includes("ERR_ABORTED") && (isNavigating || isClosing);
					if (
						!isLifecycleRequestAbort &&
						!matches(request.url(), allowedRequestFailures)
					) {
						failures.push(
							`request failed: ${request.url()} ${errorText ?? ""}`,
						);
					}
					// A failed top-level navigation never emits load. Without resetting
					// here, later stable-page aborts would be incorrectly ignored.
					if (isMainFrameNavigation(request)) {
						isNavigating = false;
					}
				});
				target.on("response", (response) => {
					if (
						response.url().includes("/api/") &&
						response.status() >= 400 &&
						!matches(response.url(), allowedResponseFailures)
					) {
						failures.push(
							`server response ${response.status()}: ${response.url()}`,
						);
					}
				});
				target.on("load", () => {
					isNavigating = false;
				});
				target.on("close", () => {
					isClosing = true;
				});
			};

			observePage(page);
			for (const existingPage of context.pages()) {
				observePage(existingPage);
			}
			const handleNewPage = (newPage: Page) => observePage(newPage);
			context.on("page", handleNewPage);

			try {
				await use({
					allowConsole: (matcher) => allowedConsole.push(matcher),
					allowRequestFailure: (matcher) =>
						allowedRequestFailures.push(matcher),
					allowResponseFailure: (matcher) =>
						allowedResponseFailures.push(matcher),
					apiRequestCount: (matcher) =>
						apiRequestUrls.filter((url) => matches(url, [matcher])).length,
					apiRequestCountPathSince: (checkpoint, pathname) =>
						apiRequestUrls
							.slice(checkpoint)
							.filter((requestUrl) => new URL(requestUrl).pathname === pathname)
							.length,
					apiRequests: () => apiRequestUrls,
					recordContentReady: (label, elapsedMs) => {
						contentReadyMetrics.push({ label, elapsedMs });
					},
					recordNavigation: (label, elapsedMs, requestCheckpoint) => {
						contentReadyMetrics.push({ label, elapsedMs });
						const requestSummary = summarizeRequests(
							apiRequestUrls.slice(requestCheckpoint),
						);
						navigationMetrics.push({
							label,
							elapsedMs,
							...requestSummary,
						});
					},
					requestCheckpoint: () => apiRequestUrls.length,
				});
			} finally {
				context.off("page", handleNewPage);
				const performanceMetrics: BrowserPerformanceMetric[] = [];

				for (const observedPage of observedPages) {
					if (observedPage.isClosed()) {
						continue;
					}
					try {
						performanceMetrics.push(await collectPagePerformance(observedPage));
					} catch {
						// A page can finish closing between isClosed() and evaluate().
					}
					try {
						await expectRouteHealthy(observedPage);
					} catch (error) {
						failures.push(
							`route health (${observedPage.url()}): ${
								error instanceof Error ? error.message : String(error)
							}`,
						);
					}
				}

				await testInfo.attach("browser-request-metrics", {
					body: JSON.stringify(
						{
							apiRequestCount: apiRequestUrls.length,
							duplicateApiRequests: [...apiRequestCounts.entries()]
								.filter(([, count]) => count > 1)
								.map(([request, count]) => ({ request, count })),
						},
						null,
						2,
					),
					contentType: "application/json",
				});
				await testInfo.attach("browser-performance-metrics", {
					body: JSON.stringify(performanceMetrics, null, 2),
					contentType: "application/json",
				});
				await testInfo.attach("browser-content-ready-metrics", {
					body: JSON.stringify(contentReadyMetrics, null, 2),
					contentType: "application/json",
				});
				await testInfo.attach("browser-navigation-metrics", {
					body: JSON.stringify(navigationMetrics, null, 2),
					contentType: "application/json",
				});

				if (failures.length > 0) {
					await testInfo.attach("browser-diagnostics", {
						body: failures.join("\n"),
						contentType: "text/plain",
					});
				}
				expect(failures).toEqual([]);
			}
		},
		{ auto: true },
	],
});

export { expect } from "@playwright/test";
