import type { Locator, Page } from "@playwright/test";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_SIMILAR_FILE_NAME,
	mediaPath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

async function openReview(page: Page) {
	await page.goto("/manager");
	await waitForAppHydration(page);
	await page
		.getByRole("button", { name: /キャラクタークラスタリング/ })
		.filter({ visible: true })
		.click();
	await expect(
		page.getByRole("heading", { name: "グループ #0", exact: true }),
	).toBeVisible();
}

async function scrollList(list: Locator, end: boolean) {
	await list.evaluate((element, toEnd) => {
		const owner = element.closest("[data-clustering-scroll]");
		if (!(owner instanceof HTMLElement))
			throw new Error("Missing review scroller");
		owner.scrollTop = toEnd ? owner.scrollHeight : 0;
	}, end);
}

async function expectMeasuredRows(list: Locator) {
	await expect
		.poll(() =>
			list.locator(":scope > [data-index]").evaluateAll((rows) => {
				let pairs = 0;
				const errors: string[] = [];
				for (let i = 1; i < rows.length; i++) {
					const previous = rows[i - 1];
					const next = rows[i];
					if (
						!previous ||
						!next ||
						Number(next.getAttribute("data-index")) !==
							Number(previous.getAttribute("data-index")) + 1
					)
						continue;
					pairs++;
					if (
						Math.abs(
							next.getBoundingClientRect().top -
								previous.getBoundingClientRect().bottom -
								12,
						) > 1
					)
						errors.push(
							`row ${previous.getAttribute("data-index")}: gap=${next.getBoundingClientRect().top - previous.getBoundingClientRect().bottom}, height=${previous.getBoundingClientRect().height}`,
						);
				}
				return pairs > 0 ? errors : ["No adjacent rows"];
			}),
		)
		.toEqual([]);
}

async function loadThroughScroll(list: Locator, count: number) {
	await expect
		.poll(async () => {
			await scrollList(list, true);
			return Number(await list.getAttribute("data-loaded"));
		})
		.toBe(count);
	// Appending a page grows the virtual spacer after the request completes.
	await expect
		.poll(async () => {
			await scrollList(list, true);
			return list.locator(`[aria-posinset="${count}"]`).count();
		})
		.toBe(1);
}

test("virtual groups and images load on scroll, stay bounded and survive comparison and reload", async ({
	page,
}, testInfo) => {
	await openReview(page);
	await expect(page.getByText("600枚", { exact: true })).toBeVisible();
	await expect(page.getByText("(50.0%)", { exact: true })).toBeVisible();
	const groups = page.getByRole("list", { name: "クラスタ一覧", exact: true });
	await loadThroughScroll(groups, 41);
	await expect(
		page.getByRole("heading", { name: "グループ #40", exact: true }),
	).toBeVisible();
	expect(await groups.getByRole("listitem").count()).toBeLessThan(20);
	await scrollList(groups, false);
	await page
		.getByRole("button", { name: "グループ #0 の60枚を確認", exact: true })
		.click();
	const dialog = page.getByRole("dialog");
	const members = dialog.getByRole("list", {
		name: "グループ画像",
		exact: true,
	});
	await expect(
		dialog.getByRole("heading", { name: "グループ #0 · 60枚" }),
	).toBeVisible();
	await loadThroughScroll(members, 60);
	expect(await members.getByRole("listitem").count()).toBeLessThan(60);
	await scrollList(members, false);
	await expect(
		dialog.getByRole("link", {
			name: `${E2E_PRIMARY_FILE_NAME}を開く`,
			exact: true,
		}),
	).toBeVisible();
	await dialog.getByRole("button", { name: "Dismiss", exact: true }).click();
	await page.getByRole("button", { name: /^同じ画像の別設定と比較/ }).click();
	await page.getByRole("option", { name: /ts-review-b/ }).click();
	await page
		.getByRole("button", { name: "グループ #0 の60枚を確認", exact: true })
		.click();
	await dialog
		.getByRole("button", { name: "強い画像から", exact: true })
		.click();
	await dialog
		.getByRole("button", { name: "境界の画像から", exact: true })
		.click();
	await expect(
		dialog.getByRole("link", {
			name: `${E2E_PRIMARY_FILE_NAME}を開く`,
			exact: true,
		}),
	).toBeVisible();
	await dialog
		.getByRole("button", { name: "画像を大きく", exact: true })
		.click();
	await expectMeasuredRows(members);
	await expect(members.getByRole("listitem").first()).toBeVisible();
	await testInfo.attach("clustering-group", {
		body: await page.screenshot(),
		contentType: "image/png",
	});
	await dialog.getByRole("button", { name: "Dismiss", exact: true }).click();
	await page.getByRole("button", { name: "ノイズを見る", exact: true }).click();
	const noise = page.getByRole("list", { name: "ノイズ画像", exact: true });
	await loadThroughScroll(noise, 300);
	await expect(
		noise.getByRole("link", { name: "e2e-scroll-0598.pngを開く", exact: true }),
	).toBeVisible();
	expect(await noise.getByRole("listitem").count()).toBeLessThan(60);
	await scrollList(noise, false);
	await expect(
		noise.getByRole("link", { name: "e2e-scroll-0299.pngを開く", exact: true }),
	).toBeVisible();
	const viewport = page.viewportSize();
	if (viewport) {
		await page.setViewportSize({
			width: viewport.width === 375 ? 768 : 375,
			height: viewport.height,
		});
		await expectMeasuredRows(noise);
		await expect(noise.getByRole("listitem").first()).toBeVisible();
		await page.setViewportSize(viewport);
	}
	await noise
		.getByRole("button", { name: "比較先: グループ #2", exact: true })
		.first()
		.click();
	await expect(
		dialog.getByRole("heading", { name: "グループ #2 · 599枚" }),
	).toBeVisible();
	await dialog.getByRole("button", { name: "Dismiss", exact: true }).click();
	await page.getByRole("button", { name: "ノイズを見る", exact: true }).click();
	await expect(
		page.getByRole("link", {
			name: `${E2E_SIMILAR_FILE_NAME}を開く`,
			exact: true,
		}),
	).toBeVisible();
	await page.reload();
	await waitForAppHydration(page);
	await expect(
		page.getByRole("link", {
			name: `${E2E_SIMILAR_FILE_NAME}を開く`,
			exact: true,
		}),
	).toBeVisible();
	await page
		.getByLabel("既存ラベル・ファイル名で絞り込む", { exact: true })
		.fill("does-not-exist");
	await page.getByRole("button", { name: "絞り込む", exact: true }).click();
	await expect(
		page.getByText("条件に一致する画像がありません", { exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "クリア", exact: true }).click();
	await page
		.getByRole("button", { name: "グループを見る", exact: true })
		.click();
	await expect(
		page.getByRole("heading", { name: "グループ #2", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "次へ", exact: true }),
	).toHaveCount(0);
	await expect
		.poll(() =>
			page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		)
		.toBe(true);
	await testInfo.attach("clustering-overview", {
		body: await page.screenshot(),
		contentType: "image/png",
	});
});

test("group cards open a virtual modal and thumbnails navigate to media details", async ({
	page,
	context,
}) => {
	await openReview(page);
	await page
		.getByRole("button", { name: "Fixture Character (1)", exact: true })
		.click();
	await expect(
		page.getByLabel("既存ラベル・ファイル名で絞り込む", { exact: true }),
	).toHaveValue("Fixture Character");
	await expect(page.getByRole("dialog")).toHaveCount(0);
	const group = page.getByRole("button", {
		name: "グループ #0 の60枚を確認",
		exact: true,
	});
	// The trigger covers the card, including its header and empty space.
	await expect
		.poll(() =>
			group.evaluate((button) => {
				const card = button.closest("article");
				return card
					? Math.abs(
							card.getBoundingClientRect().width -
								button.getBoundingClientRect().width,
						) <= 2 &&
							Math.abs(
								card.getBoundingClientRect().height -
									button.getBoundingClientRect().height,
							) <= 2
					: false;
			}),
		)
		.toBe(true);
	await group.focus();
	await group.press("Enter");
	const dialog = page.getByRole("dialog");
	await expect(
		dialog.getByRole("heading", { name: "グループ #0 · 60枚" }),
	).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	await group.click({ position: { x: 20, y: 20 } });
	await expect(
		dialog.getByRole("list", { name: "グループ画像", exact: true }),
	).toBeVisible();
	const thumbnail = dialog.getByRole("link", {
		name: `${E2E_PRIMARY_FILE_NAME}を開く`,
		exact: true,
	});
	await expect(thumbnail).not.toHaveAttribute("target", "_blank");
	await thumbnail.click();
	await expect(page).toHaveURL(mediaPath());
	await expect(
		page.getByRole("img", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
	).toBeVisible();
	expect(context.pages()).toHaveLength(1);
	await page.reload();
	await waitForAppHydration(page);
	await expect(
		page.getByRole("img", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
	).toBeVisible();
	await page.goBack();
	await expect(
		page.getByRole("heading", {
			name: "キャラクタークラスタリング",
			exact: true,
		}),
	).toBeVisible();
});

test("initial loading, next-page failure and offline recovery preserve the current list and filter", async ({
	page,
	context,
	browserHealth,
}) => {
	let release: () => void = () => {};
	const delayed = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/api/rpc/characters/clusteringGroups", async (route) => {
		await delayed;
		await route.continue();
	});
	await page.goto("/manager");
	await waitForAppHydration(page);
	await page
		.getByRole("button", { name: /キャラクタークラスタリング/ })
		.filter({ visible: true })
		.click();
	await expect(
		page.getByRole("heading", {
			name: "キャラクタークラスタリング",
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByText("画像一覧を読み込んでいます…", { exact: true }),
	).toBeVisible();
	release();
	await expect(
		page.getByRole("heading", { name: "グループ #0", exact: true }),
	).toBeVisible();
	await page.unroute("**/api/rpc/characters/clusteringGroups");
	browserHealth.allowResponseFailure("/characters/clusteringMedia");
	browserHealth.allowConsole("503");
	await page.route("**/api/rpc/characters/clusteringMedia", (route) =>
		route.fulfill({ status: 503, body: "Temporarily unavailable" }),
	);
	await page.getByRole("button", { name: "ノイズを見る", exact: true }).click();
	await expect(
		page.getByText("画像一覧を取得できませんでした", { exact: true }),
	).toBeVisible({ timeout: 30_000 });
	await page.unroute("**/api/rpc/characters/clusteringMedia");
	await page
		.getByRole("button", { name: "結果を再読み込み", exact: true })
		.click();
	const filter = page.getByLabel("既存ラベル・ファイル名で絞り込む", {
		exact: true,
	});
	await filter.fill("draft filter");
	const noise = page.getByRole("list", { name: "ノイズ画像", exact: true });
	await expect(noise).toHaveAttribute("data-loaded", "48");
	await expect(filter).toBeFocused();
	await page.route("**/api/rpc/characters/clusteringMedia", (route) => {
		const body = route.request().postDataJSON();
		return body?.json?.offset >= 48
			? route.fulfill({ status: 503, body: "Temporarily unavailable" })
			: route.continue();
	});
	await scrollList(noise, true);
	await expect(
		page.getByText("続きを取得できませんでした", { exact: true }),
	).toBeVisible({ timeout: 30_000 });
	await expect(noise).toHaveAttribute("data-loaded", "48");
	await expect(filter).toHaveValue("draft filter");
	await page.unroute("**/api/rpc/characters/clusteringMedia");
	await page.getByRole("button", { name: "再試行", exact: true }).click();
	await expect
		.poll(async () => Number(await noise.getAttribute("data-loaded")))
		.toBeGreaterThanOrEqual(96);
	await scrollList(noise, false);
	await expect(
		noise.getByRole("link", { name: "e2e-scroll-0299.pngを開く", exact: true }),
	).toBeVisible();
	await filter.focus();
	await expect(filter).toHaveValue("draft filter");
	await filter.fill("e2e-scroll-0598");
	await page.getByRole("button", { name: "絞り込む", exact: true }).click();
	await expect(noise).toHaveAttribute("data-loaded", "1");
	await expect(
		noise.getByRole("link", { name: "e2e-scroll-0598.pngを開く", exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "クリア", exact: true }).click();
	await expect(
		noise.getByRole("link", { name: "e2e-scroll-0299.pngを開く", exact: true }),
	).toBeVisible();
	browserHealth.allowConsole("ERR_INTERNET_DISCONNECTED");
	browserHealth.allowRequestFailure(/\/api\/sources\/[^/]+\/thumbnail\//);
	await context.setOffline(true);
	await filter.fill("offline filter");
	await page.getByRole("button", { name: "絞り込む", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "オフラインです", exact: true }),
	).toBeVisible();
	await expect(
		page.getByText("条件に一致する画像がありません", { exact: true }),
	).toHaveCount(0);
	await context.setOffline(false);
	await expect(
		page.getByText("条件に一致する画像がありません", { exact: true }),
	).toBeVisible();
	await expect(filter).toHaveValue("offline filter");
});
