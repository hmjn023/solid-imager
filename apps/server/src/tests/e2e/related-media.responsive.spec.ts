import type { Page } from "@playwright/test";
import { z } from "zod";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SIMILAR_FILE_NAME,
	E2E_SIMILAR_MEDIA_ID,
	mediaPath,
} from "./support/fixture";
import {
	withRelatedMedia,
	withRelatedMediaTag,
} from "./support/related-media-fixture";
import { expect, test, waitForAppHydration } from "./support/test";

const relatedEndpoint = "**/api/rpc/media/getRelated";
const relatedSection = (page: Page) =>
	page.getByRole("region", { name: "関連メディア", exact: true });

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
	expect(
		await page.evaluate(
			() =>
				document.documentElement.scrollWidth -
				document.documentElement.clientWidth,
		),
	).toBeLessThanOrEqual(1);
}

test("tag recommendations retain their seed on Back and reload, and refresh without losing content", async ({
	page,
}) => {
	await withRelatedMediaTag(page.request, async () => {
		const requestSchema = z.object({
			json: z.object({ mediaId: z.string(), seed: z.string().min(1) }),
		});
		const seeds: string[] = [];
		page.on("request", (request) => {
			if (!request.url().endsWith("/api/rpc/media/getRelated")) return;
			const payload = requestSchema.parse(request.postDataJSON()).json;
			if (payload.mediaId === E2E_PRIMARY_MEDIA_ID) seeds.push(payload.seed);
		});
		await page.goto(mediaPath());
		await waitForAppHydration(page);
		const related = relatedSection(page);
		await related.scrollIntoViewIfNeeded();
		const candidate = related.locator(
			`[data-media-id="${E2E_SIMILAR_MEDIA_ID}"]`,
		);
		await expect(candidate).toBeVisible();
		await expect(
			related.getByText("タグが近い", { exact: true }).last(),
		).toBeVisible();
		await related.getByRole("tab", { name: "タグが近い", exact: true }).click();
		await expect(candidate).toBeVisible();
		await expect.poll(() => seeds.length).toBeGreaterThan(0);
		const originalSeed = seeds[0];

		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		await page.route(relatedEndpoint, async (route) => {
			const response = await route.fetch();
			await gate;
			await route.fulfill({ response });
		});
		const refresh = related.getByRole("button", {
			name: "関連メディアを再取得",
			exact: true,
		});
		try {
			await refresh.click();
			await expect.poll(() => seeds.at(-1)).not.toBe(originalSeed);
			await expect(refresh).toBeDisabled();
			await expect(candidate).toBeVisible();
			await expect(
				related.getByRole("tab", { name: "タグが近い", exact: true }),
			).toHaveAttribute("aria-selected", "true");
		} finally {
			release();
		}
		await expect(refresh).toBeEnabled();
		const refreshedSeed = seeds.at(-1);
		await page.unroute(relatedEndpoint);
		await candidate.click();
		await expect(page).toHaveURL(mediaPath(E2E_SIMILAR_MEDIA_ID));
		await related.scrollIntoViewIfNeeded();
		await expect(
			related.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`),
		).toBeVisible();
		await page.goBack();
		await expect(page).toHaveURL(mediaPath());
		await related.scrollIntoViewIfNeeded();
		await expect(candidate).toBeVisible();
		const beforeReload = seeds.length;
		await page.reload();
		await waitForAppHydration(page);
		await related.scrollIntoViewIfNeeded();
		await expect(candidate).toBeVisible();
		await expect.poll(() => seeds.length).toBeGreaterThan(beforeReload);
		expect(seeds.at(-1)).toBe(refreshedSeed);
		await expectNoHorizontalOverflow(page);
	});
});

test(
	"failed recommendation refresh preserves candidates and retries the attempted seed",
	{ tag: "@desktop-only" },
	async ({ page, browserHealth }) => {
		await withRelatedMediaTag(page.request, async () => {
			await page.goto(mediaPath());
			await waitForAppHydration(page);
			const related = relatedSection(page);
			await related.scrollIntoViewIfNeeded();
			const candidate = related.locator(
				`[data-media-id="${E2E_SIMILAR_MEDIA_ID}"]`,
			);
			await expect(candidate).toBeVisible();
			browserHealth.allowResponseFailure("/api/rpc/media/getRelated");
			browserHealth.allowConsole(/503/);
			const seeds: string[] = [];
			let failing = true;
			await page.route(relatedEndpoint, async (route) => {
				const {
					json: { seed },
				} = z
					.object({ json: z.object({ seed: z.string() }) })
					.parse(route.request().postDataJSON());
				seeds.push(seed);
				if (!failing) return route.continue();
				await route.fulfill({
					status: 503,
					json: {
						json: {
							code: "SERVICE_UNAVAILABLE",
							message: "temporarily unavailable",
						},
					},
				});
			});
			await related
				.getByRole("button", { name: "関連メディアを再取得", exact: true })
				.click();
			await expect(
				related.getByText("関連メディアを更新できませんでした", {
					exact: true,
				}),
			).toBeVisible();
			await expect(candidate).toBeVisible();
			const failedSeed = seeds[0];
			expect(failedSeed).toBeTruthy();
			failing = false;
			await related
				.getByRole("button", { name: "関連メディアを再取得", exact: true })
				.last()
				.click();
			await expect(
				related.getByText("関連メディアを更新できませんでした", {
					exact: true,
				}),
			).toHaveCount(0);
			await expect(candidate).toBeVisible();
			expect(seeds.length).toBeGreaterThan(1);
			expect(new Set(seeds)).toEqual(new Set([failedSeed]));
		});
	},
);

test("related media filters real relations and follows navigation, reload, and browser Back", async ({
	page,
}, testInfo) => {
	await withRelatedMedia(page.request, async () => {
		await page.goto(mediaPath());
		await waitForAppHydration(page);
		const related = relatedSection(page);
		await related.scrollIntoViewIfNeeded();
		const candidate = related.locator(
			`[data-media-id="${E2E_SIMILAR_MEDIA_ID}"]`,
		);
		await expect(candidate).toBeVisible();
		await expect(candidate).toHaveCount(1);
		await expect(
			related.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`),
		).toHaveCount(0);
		for (const name of ["同じキャラ", "同じIP"]) {
			await related.getByRole("tab", { name, exact: true }).click();
			await expect(candidate).toBeVisible();
			await expect(candidate).toHaveCount(1);
		}
		await related.getByRole("tab", { name: "おすすめ", exact: true }).click();
		const thumbnail = candidate.getByRole("img");
		await expect
			.poll(() =>
				thumbnail.evaluate(
					(image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
				),
			)
			.toBe(true);
		await expectNoHorizontalOverflow(page);
		await page.screenshot({
			path: testInfo.outputPath("related-media.png"),
			animations: "disabled",
		});

		await candidate.click();
		await expect(page).toHaveURL(mediaPath(E2E_SIMILAR_MEDIA_ID));
		await expect(
			page.getByRole("heading", { name: E2E_SIMILAR_FILE_NAME, exact: true }),
		).toBeVisible();
		await related.scrollIntoViewIfNeeded();
		await expect(
			related.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`),
		).toBeVisible();
		await expect(
			related.locator(`[data-media-id="${E2E_SIMILAR_MEDIA_ID}"]`),
		).toHaveCount(0);
		await page.reload();
		await waitForAppHydration(page);
		await related.scrollIntoViewIfNeeded();
		await expect(
			related.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`),
		).toBeVisible();
		await page.goBack();
		await expect(page).toHaveURL(mediaPath());
		await expect(
			page.getByRole("heading", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
		).toBeVisible();
		await related.scrollIntoViewIfNeeded();
		await expect(candidate).toBeVisible();
		await expectNoHorizontalOverflow(page);
	});
});

test(
	"related navigation preserves the original collection return history",
	{ tag: "@desktop-only" },
	async ({ page }) => {
		await withRelatedMedia(page.request, async () => {
			await page.goto("/about");
			await waitForAppHydration(page);
			await page.getByRole("link", { name: "Library", exact: true }).click();
			await expect(page).toHaveURL("/search");
			const primary = page.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`);
			await primary.focus();
			await primary.press("Enter");
			await expect(page).toHaveURL(mediaPath());
			const related = relatedSection(page);
			await related.scrollIntoViewIfNeeded();
			await related
				.locator(`[data-media-id="${E2E_SIMILAR_MEDIA_ID}"]`)
				.click();
			await expect(page).toHaveURL(mediaPath(E2E_SIMILAR_MEDIA_ID));
			await page
				.getByRole("button", { name: "一覧に戻る", exact: true })
				.click();
			// Search adds its saved snapshot ID when leaving for a detail.
			await expect.poll(() => new URL(page.url()).pathname).toBe("/search");
			await expect(primary).toBeVisible();
			await page.goBack();
			await expect(page).toHaveURL("/about");
		});
	},
);

test(
	"related return context does not jump into a different browser history branch",
	{ tag: "@desktop-only" },
	async ({ page, browserHealth }) => {
		// This scenario deliberately leaves details before supplemental queries
		// finish; disposing those queries cancels their requests during SPA navigation.
		browserHealth.allowRequestFailure(
			/\/api\/rpc\/(?:projects\/listForMedia|media\/getRelated)(?:\?|$)/,
			"net::ERR_ABORTED",
		);
		await withRelatedMedia(page.request, async () => {
			await page.goto("/about");
			await waitForAppHydration(page);
			await page.getByRole("link", { name: "Library", exact: true }).click();
			const primary = page.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`);
			await primary.focus();
			await primary.press("Enter");
			await expect(page).toHaveURL(mediaPath());
			await relatedSection(page).scrollIntoViewIfNeeded();
			await relatedSection(page)
				.locator(`[data-media-id="${E2E_SIMILAR_MEDIA_ID}"]`)
				.click();
			await expect(page).toHaveURL(mediaPath(E2E_SIMILAR_MEDIA_ID));
			await expect(
				page.getByRole("heading", { name: E2E_SIMILAR_FILE_NAME, exact: true }),
			).toBeVisible();
			await page.goBack();
			await expect(page).toHaveURL(mediaPath());
			await expect(
				page.getByRole("heading", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
			).toBeVisible();
			await page.goBack();
			await expect.poll(() => new URL(page.url()).pathname).toBe("/search");
			await page.goBack();
			await expect(page).toHaveURL("/about");
			await page.getByRole("link", { name: "Jobs", exact: true }).click();
			await expect(page).toHaveURL("/jobs");
			await page.getByRole("link", { name: "Manager", exact: true }).click();
			await page
				.getByRole("button", { name: /キャラクタークラスタリング/ })
				.filter({ visible: true })
				.click();
			await page
				.getByRole("button", { name: "グループ #0 の60枚を確認", exact: true })
				.click();
			await page
				.getByRole("dialog")
				.getByRole("link", {
					name: `${E2E_PRIMARY_FILE_NAME}を開く`,
					exact: true,
				})
				.click();
			await expect(page).toHaveURL(mediaPath());
			await page
				.getByRole("button", { name: "一覧に戻る", exact: true })
				.click();
			await expect.poll(() => new URL(page.url()).pathname).toBe("/search");
			await expect(primary).toBeVisible();
		});
	},
);

test(
	"related loading stays local to the section",
	{ tag: "@desktop-only" },
	async ({ page }) => {
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		await page.route(relatedEndpoint, async (route) => {
			const response = await route.fetch();
			await gate;
			await route.fulfill({ response });
		});
		try {
			await page.goto(mediaPath());
			await waitForAppHydration(page);
			await expect(
				page
					.locator("[data-media-viewer]")
					.getByRole("img", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
			).toBeVisible();
			await expect(
				page.getByRole("button", { name: "一覧に戻る", exact: true }),
			).toBeVisible();
			const related = relatedSection(page);
			await related.scrollIntoViewIfNeeded();
			await expect(related.getByRole("status")).toBeVisible();
		} finally {
			release();
		}
		await expect(
			relatedSection(page).getByRole("tab", { name: "おすすめ", exact: true }),
		).toBeVisible();
	},
);

for (const failure of ["503", "connectionrefused"] as const) {
	test(
		`related ${failure} failure can be retried without losing the detail`,
		{ tag: "@desktop-only" },
		async ({ page, browserHealth }) => {
			await withRelatedMedia(page.request, async () => {
				browserHealth.allowResponseFailure("/api/rpc/media/getRelated");
				browserHealth.allowRequestFailure(
					"/api/rpc/media/getRelated",
					"ERR_CONNECTION_REFUSED",
				);
				browserHealth.allowConsole(/503|ERR_CONNECTION_REFUSED/);
				let failing = true;
				await page.route(relatedEndpoint, async (route) => {
					if (!failing) return route.continue();
					if (failure === "connectionrefused")
						return route.abort("connectionrefused");
					await route.fulfill({
						status: 503,
						contentType: "application/json",
						body: JSON.stringify({
							json: {
								code: "SERVICE_UNAVAILABLE",
								message: "temporarily unavailable",
							},
						}),
					});
				});
				await page.goto(mediaPath());
				await waitForAppHydration(page);
				const related = relatedSection(page);
				await related.scrollIntoViewIfNeeded();
				const retry = related.getByRole("button", {
					name: "関連メディアを再取得",
					exact: true,
				});
				await expect(retry).toBeVisible();
				await expect(
					page.getByRole("heading", {
						name: E2E_PRIMARY_FILE_NAME,
						exact: true,
					}),
				).toBeVisible();
				failing = false;
				await retry.click();
				await expect(
					related.locator(`[data-media-id="${E2E_SIMILAR_MEDIA_ID}"]`),
				).toBeVisible();
			});
		},
	);
}

test(
	"empty related media does not suggest unrelated images",
	{ tag: "@desktop-only" },
	async ({ page }) => {
		await page.route(relatedEndpoint, (route) =>
			route.fulfill({
				json: {
					json: {
						items: [],
						recommendations: [],
						similarityStatus: "available",
					},
				},
			}),
		);
		await page.goto(mediaPath());
		await waitForAppHydration(page);
		const related = relatedSection(page);
		await related.scrollIntoViewIfNeeded();
		await expect(
			related.getByRole("tab", { name: "おすすめ", exact: true }),
		).toBeVisible();
		await expect(related.locator("[data-media-id]")).toHaveCount(0);
		await expect(related).toContainText(/見つかりません|ありません/);
	},
);
