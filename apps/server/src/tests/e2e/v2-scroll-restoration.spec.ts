import type { Page } from "@playwright/test";
import { E2E_SOURCE_ID, E2E_SOURCE_NAME } from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

const searchEndpoint = "**/api/rpc/media/search**";

function getSearchOffset(postData: string | null): number | undefined {
	const offset = postData?.match(/"offset"\s*:\s*(\d+)/)?.[1];
	return offset === undefined ? undefined : Number(offset);
}

async function verifyRestoredScrollerDuringFastPageFetch(
	page: Page,
	entryPath: string,
	heading: string,
	scrollerSelector: string,
	returnMethod: "browser" | "ui",
): Promise<void> {
	await page.setViewportSize({ width: 1280, height: 633 });

	let delaySearchRequests = false;
	let highestRequestedOffset = 0;
	let delayedNextPageRequestCount = 0;
	let delayedNextPageRequestHeld = false;
	let releaseDelayedNextPageRequest: () => void = () => {};
	const delayedNextPageRequest = new Promise<void>((resolve) => {
		releaseDelayedNextPageRequest = resolve;
	});
	await page.addInitScript(() => {
		sessionStorage.removeItem("current-all");
		sessionStorage.removeItem("solid-imager-scroll-positions");
		sessionStorage.removeItem("v2:media-return");
	});
	await page.route(searchEndpoint, async (route) => {
		if (route.request().method() === "POST") {
			const offset = getSearchOffset(route.request().postData());
			const isBeyondLoadedPages =
				offset !== undefined && offset > highestRequestedOffset;
			if (offset !== undefined) {
				highestRequestedOffset = Math.max(highestRequestedOffset, offset);
			}
			const shouldHoldRequest =
				isBeyondLoadedPages &&
				delaySearchRequests &&
				!delayedNextPageRequestHeld;
			if (shouldHoldRequest) {
				delayedNextPageRequestHeld = true;
				delayedNextPageRequestCount += 1;
				const response = await route.fetch();
				const responseBody = await response.body();
				const responseHeaders = response.headers();
				const responseStatus = response.status();
				await delayedNextPageRequest;
				await new Promise((resolve) => setTimeout(resolve, 1000));
				await route.fulfill({
					body: responseBody,
					headers: responseHeaders,
					status: responseStatus,
				});
				return;
			}
		}
		await route.continue();
	});

	await page.goto(entryPath);
	await waitForAppHydration(page);
	await expect(page.getByText(heading, { exact: true }).last()).toBeVisible();

	const scroller = page.locator(scrollerSelector);
	await expect(scroller.locator("[data-media-id]").first()).toBeVisible();
	await expect
		.poll(() => scroller.evaluate((element) => element.scrollHeight))
		.toBeGreaterThan(2000);
	await scroller.hover();
	await page.mouse.wheel(0, 1500);
	await expect
		.poll(() => scroller.evaluate((element) => element.scrollTop))
		.toBeGreaterThan(1000);
	await page.waitForTimeout(300);
	await expect
		.poll(() => scroller.evaluate((element) => element.scrollTop))
		.toBeGreaterThan(1000);

	const mediaId = await scroller.evaluate((element) => {
		const bounds = element.getBoundingClientRect();
		return [...element.querySelectorAll<HTMLElement>("[data-media-id]")].find(
			(item) => {
				const itemBounds = item.getBoundingClientRect();
				return itemBounds.bottom > bounds.top && itemBounds.top < bounds.bottom;
			},
		)?.dataset.mediaId;
	});
	expect(mediaId).toBeDefined();
	if (!mediaId) throw new Error("A visible media item was not found");
	const mediaFileName = await page
		.locator(`[data-media-id="${mediaId}"] img`)
		.getAttribute("alt");
	expect(mediaFileName).toBeTruthy();
	if (!mediaFileName)
		throw new Error("The visible media item has no file name");

	await page.locator(`[data-media-id="${mediaId}"]`).click();
	await expect(page).toHaveURL(/\/v2\/sources\/[^/]+\/[^/]+$/);
	await expect(
		page.getByRole("heading", { name: mediaFileName, exact: true }),
	).toBeVisible();

	const loadedOffsetBeforeReturn = highestRequestedOffset;
	delaySearchRequests = true;
	if (returnMethod === "browser") {
		await page.goBack();
	} else {
		await page.getByRole("button", { name: "一覧に戻る", exact: true }).click();
	}
	await expect.poll(() => new URL(page.url()).pathname).toBe(entryPath);
	await waitForAppHydration(page);
	await expect(scroller.locator("[data-media-id]").first()).toBeVisible();
	await expect
		.poll(() => scroller.evaluate((element) => element.scrollTop))
		.toBeGreaterThan(1000);
	await page.evaluate(
		() =>
			new Promise<void>((resolve) => {
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
			}),
	);

	await page.evaluate((selector) => {
		const main = document.querySelector("#v2-main-content");
		const initialScroller = document.querySelector<HTMLElement>(selector);
		if (!main || !initialScroller) {
			throw new Error("v2 media scroll containers were not found");
		}

		const probe = {
			initialMain: main,
			initialScroller,
			removedSections: 0,
			scrollTops: [] as number[],
		};
		const observer = new MutationObserver((records) => {
			for (const record of records) {
				if (record.target !== main) continue;
				probe.removedSections += [...record.removedNodes].filter(
					(node) => node instanceof HTMLElement && node.tagName === "SECTION",
				).length;
			}
		});
		observer.observe(main, { childList: true });
		window.addEventListener(
			"scroll",
			(event) => {
				if (event.target instanceof HTMLElement) {
					probe.scrollTops.push(event.target.scrollTop);
				}
			},
			true,
		);
		Object.assign(window, { __v2ScrollProbe: probe });
	}, scrollerSelector);

	const heightBeforeFetch = await scroller.evaluate(
		(element) => element.scrollHeight,
	);
	const nextPageResponsePromise = page.waitForResponse(
		(response) =>
			response.url().includes("/api/rpc/media/search") &&
			(getSearchOffset(response.request().postData()) ?? 0) >
				loadedOffsetBeforeReturn,
		{ timeout: 30_000 },
	);
	await scroller.hover();
	await scroller.evaluate((element) => {
		element.scrollTop = element.scrollHeight;
		element.dispatchEvent(new Event("scroll"));
	});
	await expect.poll(() => delayedNextPageRequestCount).toBeGreaterThan(0);
	await page.waitForTimeout(100);

	const probeDuringFetch = await page.evaluate((selector) => {
		const probe = (
			window as Window & {
				__v2ScrollProbe?: {
					initialMain: Element;
					initialScroller: Element;
					removedSections: number;
					scrollTops: number[];
				};
			}
		).__v2ScrollProbe;
		const currentScroller = document.querySelector(selector);
		return {
			scrollEventCount: probe?.scrollTops.length ?? 0,
			removedSections: probe?.removedSections ?? -1,
			mainWasReplaced:
				probe?.initialMain !== document.querySelector("#v2-main-content"),
			scrollerWasReplaced: probe?.initialScroller !== currentScroller,
			minObservedScrollTop: probe?.scrollTops.length
				? Math.min(...probe.scrollTops)
				: -1,
			finalScrollTop:
				currentScroller instanceof HTMLElement ? currentScroller.scrollTop : -1,
		};
	}, scrollerSelector);

	expect(probeDuringFetch.removedSections).toBe(0);
	expect(probeDuringFetch.scrollEventCount).toBeGreaterThan(0);
	expect(probeDuringFetch.mainWasReplaced).toBe(false);
	expect(probeDuringFetch.scrollerWasReplaced).toBe(false);
	expect(probeDuringFetch.minObservedScrollTop).toBeGreaterThan(0);
	expect(probeDuringFetch.finalScrollTop).toBeGreaterThan(1000);

	releaseDelayedNextPageRequest();
	const nextPageResponse = await nextPageResponsePromise;
	expect(nextPageResponse.status()).toBe(200);
	await expect
		.poll(() => scroller.evaluate((element) => element.scrollHeight), {
			timeout: 10_000,
		})
		.toBeGreaterThan(heightBeforeFetch);
	const probeAfterFetch = await page.evaluate((selector) => {
		const probe = (
			window as Window & {
				__v2ScrollProbe?: {
					initialMain: Element;
					initialScroller: Element;
					removedSections: number;
				};
			}
		).__v2ScrollProbe;
		const currentScroller = document.querySelector(selector);
		return {
			removedSections: probe?.removedSections ?? -1,
			mainWasReplaced:
				probe?.initialMain !== document.querySelector("#v2-main-content"),
			scrollerWasReplaced: probe?.initialScroller !== currentScroller,
			finalScrollTop:
				currentScroller instanceof HTMLElement ? currentScroller.scrollTop : -1,
		};
	}, scrollerSelector);
	expect(probeAfterFetch.removedSections).toBe(0);
	expect(probeAfterFetch.mainWasReplaced).toBe(false);
	expect(probeAfterFetch.scrollerWasReplaced).toBe(false);
	expect(probeAfterFetch.finalScrollTop).toBeGreaterThan(1000);
}

const restorationCases = [
	{
		name: "v2 search",
		entryPath: "/v2/search",
		heading: "すべてのメディア",
		scrollerSelector: '[data-media-scroll="v2-search"]',
	},
	{
		name: "v2 source media",
		entryPath: `/v2/sources/${E2E_SOURCE_ID}`,
		heading: E2E_SOURCE_NAME,
		scrollerSelector: `[data-media-scroll="${E2E_SOURCE_ID}"]`,
	},
] as const;
for (const restorationCase of restorationCases) {
	for (const returnMethod of ["browser", "ui"] as const) {
		test(`${restorationCase.name} keeps its restored scroller mounted during a fast page fetch via ${returnMethod} back`, async ({
			page,
		}) => {
			await verifyRestoredScrollerDuringFastPageFetch(
				page,
				restorationCase.entryPath,
				restorationCase.heading,
				restorationCase.scrollerSelector,
				returnMethod,
			);
		});
	}
}
