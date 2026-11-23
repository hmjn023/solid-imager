import { randomUUID } from "node:crypto";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { apiPathPattern, apiRequest, apiRoute } from "./support/api";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_SIMILAR_FILE_NAME,
	getE2eRuntimeDir,
	getFixtureMediaPath,
} from "./support/fixture";
import { selectManagerCategory } from "./support/manager-navigation";
import { openRelatedMedia } from "./support/related-media-fixture";
import { expect, test as base, waitForAppHydration } from "./support/test";

const test = base.extend<{
	embeddingSource: { sourceId: string; sourceName: string };
}>({
	embeddingSource: async ({ request }, use) => {
		const configResponse = await apiRequest(request, "config/get", {});
		await expect(configResponse).toBeOK();
		const config = await configResponse.json();
		const sourceId = randomUUID();
		const sourceName = `Embedding test ${sourceId}`;
		const directory = path.join(getE2eRuntimeDir(), sourceId);
		try {
			// Run real inference on the portable CPU provider.
			const configured = await apiRequest(request, "config/update", {
				ai: { ...config.ai, provider: "cpu", device: "" },
			});
			await expect(configured).toBeOK();
			await mkdir(directory);
			try {
				for (const name of [E2E_PRIMARY_FILE_NAME, E2E_SIMILAR_FILE_NAME])
					await copyFile(getFixtureMediaPath(name), path.join(directory, name));
				const created = await apiRequest(request, "sources/create", {
					id: sourceId,
					name: sourceName,
					description: null,
					type: "local",
					connectionInfo: { path: directory },
				});
				await expect(created).toBeOK();
				try {
					const synced = await apiRequest(request, "sources/sync", {
						ids: [sourceId],
					});
					await expect(synced).toBeOK();
					await use({ sourceId, sourceName });
				} finally {
					const removed = await apiRequest(request, "sources/delete", {
						id: sourceId,
					});
					await expect(removed).toBeOK();
				}
			} finally {
				await rm(directory, { recursive: true, force: true });
			}
		} finally {
			const restored = await apiRequest(request, "config/update", {
				ai: config.ai,
			});
			await expect(restored).toBeOK();
		}
	},
});

test("indexes real EmbeddingGemma 2 images and restores natural language and image searches after reload", async ({
	page,
	browserHealth,
	embeddingSource,
}, testInfo) => {
	test.setTimeout(240_000);
	// Leaving Manager and reloading detail intentionally close its job stream;
	// Chromium can report the final abort after the next document has loaded.
	browserHealth.allowRequestFailure(apiPathPattern("jobs/events"));
	// Starting a similarity search can dispose a pending detail query.
	browserHealth.allowRequestFailure(
		apiPathPattern("media/getDetails"),
		"net::ERR_ABORTED",
	);
	const { sourceId, sourceName } = embeddingSource;
	let primaryId = "";
	await expect
		.poll(async () => {
			const response = await apiRequest(page.request, "media/search", {
				sourceId,
				params: { limit: 20, offset: 0 },
			});
			const data = await response.json();
			primaryId =
				data.media.find(
					(item: { fileName: string }) =>
						item.fileName === E2E_PRIMARY_FILE_NAME,
				)?.id ?? "";
			return data.total;
		})
		.toBe(2);
	await page.goto(`/sources/${sourceId}/${primaryId}`);
	await waitForAppHydration(page);
	await page.getByRole("button", { name: "その他の操作", exact: true }).click();
	const extractionResponse = page.waitForResponse(
		(response) =>
			apiRoute("ai/startEmbeddingExtraction")(new URL(response.url())) &&
			response.status() === 200,
	);
	await page
		.getByRole("menuitem", {
			name: "EmbeddingGemma 2のベクトルを抽出",
			exact: true,
		})
		.click();
	const extraction = await (await extractionResponse).json();
	await expect(
		page.getByText("EmbeddingGemma 2の抽出を登録しました", { exact: true }),
	).toBeVisible();
	await expect
		.poll(
			async () => {
				const response = await apiRequest(page.request, "jobs/get", {
					id: extraction.jobId,
				});
				expect(response.ok()).toBe(true);
				const job = await response.json();
				expect(job.type).toBe("extract_embedding_vector");
				return job.status;
			},
			{ timeout: 180_000 },
		)
		.toBe("completed");
	await page.goto("/manager");
	await selectManagerCategory(page, "ベクトル抽出");
	await expect(
		page.getByRole("button", { name: /^ベクトル抽出モデル/ }),
	).toContainText("EmbeddingGemma 2");
	await page.getByRole("button", { name: /^対象ソース / }).click();
	await page.getByRole("option", { name: sourceName, exact: true }).click();
	await page.getByRole("button", { name: "抽出を開始", exact: true }).click();
	await expect(
		page.getByText("一括操作が完了しました。", {
			exact: true,
		}),
	).toBeVisible({ timeout: 180_000 });

	await page.goto(`/sources/${sourceId}`);
	await waitForAppHydration(page);
	const sourceFilters = page.getByRole("button", { name: /^検索フィルター/ });
	await sourceFilters.click();
	const naturalLanguageSearch = "自然言語検索（EmbeddingGemma 2）";
	const sourceTextSearch = page.getByRole("textbox", {
		name: naturalLanguageSearch,
		exact: true,
	});
	await expect(sourceTextSearch).toBeHidden();
	await page
		.getByRole("button", { name: naturalLanguageSearch, exact: true })
		.click();
	await expect(sourceTextSearch).toBeVisible();
	await sourceFilters.click();
	const sourceSearch = page.locator("#search-composer");
	await expect(sourceSearch).toBeVisible();
	await sourceSearch.fill("text:アニメの キャラクター");
	const sourceSearchResponse = page.waitForResponse(
		(response) =>
			apiRoute("media/searchSemantic")(new URL(response.url())) &&
			response.status() === 200,
	);
	await sourceSearch.press("Enter");
	await sourceSearchResponse;
	await expect(
		page.getByRole("button", { name: "文章:アニメの キャラクターを解除" }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible({ timeout: 60_000 });

	await page.goto("/search");
	await waitForAppHydration(page);
	const filters = page.getByRole("button", { name: /^検索フィルター、/ });
	await filters.click();
	const dialog = page.getByRole("dialog", {
		name: "検索フィルター",
		exact: true,
	});
	const textSearchToggle = dialog.getByRole("button", {
		name: naturalLanguageSearch,
		exact: true,
	});
	const textSearch = dialog.getByRole("textbox", {
		name: naturalLanguageSearch,
		exact: true,
	});
	await textSearchToggle.click();
	await textSearch.fill("アニメのキャラクター");
	await textSearchToggle.click();
	await expect(textSearch).toBeHidden();
	await textSearchToggle.click();
	await expect(textSearch).toHaveValue("アニメのキャラクター");
	await dialog
		.getByRole("button", { name: "文章で画像・動画を検索", exact: true })
		.click();
	await expect(dialog).toBeHidden();
	await expect(
		page.getByRole("button", {
			name: "文章:アニメのキャラクターを解除",
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible();
	await page.waitForFunction(() => {
		const snapshot = history.state?.searchSnapshot;
		return (
			snapshot?.id === new URL(location.href).searchParams.get("search") &&
			snapshot?.state?.semanticQuery === "アニメのキャラクター"
		);
	});
	const semanticReload = browserHealth.requestCheckpoint();
	await page.reload();
	await waitForAppHydration(page);
	await expect(
		page.getByRole("button", {
			name: "文章:アニメのキャラクターを解除",
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible();
	expect(
		browserHealth.apiRequestCountPathSince(
			semanticReload,
			"/api/media/search/semantic",
		),
	).toBe(0);
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					document.documentElement.scrollWidth -
					document.documentElement.clientWidth,
			),
		)
		.toBeLessThanOrEqual(1);

	await page.goto(`/sources/${sourceId}/${primaryId}`);
	await waitForAppHydration(page);
	const relatedMedia = page.getByRole("region", {
		name: "関連メディア",
		exact: true,
	});
	await openRelatedMedia(page);
	await relatedMedia
		.getByRole("tab", { name: "似た画像", exact: true })
		.click();
	await expect(
		relatedMedia.getByRole("link", {
			name: new RegExp(E2E_SIMILAR_FILE_NAME),
		}),
	).toBeVisible();
	await expect(
		relatedMedia.locator(`[data-media-id="${primaryId}"]`),
	).toHaveCount(0);
	await page.getByRole("button", { name: "その他の操作", exact: true }).click();
	await page
		.getByRole("menuitem", {
			name: "類似検索（EmbeddingGemma 2）",
			exact: true,
		})
		.click();
	await expect(page).toHaveURL(/\/search/);
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_SIMILAR_FILE_NAME) }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toHaveCount(0);
	await page.waitForFunction((anchorId) => {
		const snapshot = history.state?.searchSnapshot;
		return (
			snapshot?.id === new URL(location.href).searchParams.get("search") &&
			snapshot?.state?.similarityAnchorMediaId === anchorId
		);
	}, primaryId);
	const similarityReload = browserHealth.requestCheckpoint();
	await page.reload();
	await waitForAppHydration(page);
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_SIMILAR_FILE_NAME) }),
	).toBeVisible();
	expect(
		browserHealth.apiRequestCountPathSince(
			similarityReload,
			"/api/media/search/similar",
		),
	).toBe(0);
	await filters.click();
	await expect(
		dialog.getByRole("button", { name: /^類似検索モデル/ }),
	).toContainText("EmbeddingGemma 2");
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					document.documentElement.scrollWidth -
					document.documentElement.clientWidth,
			),
		)
		.toBeLessThanOrEqual(1);
	await page.screenshot({
		path: testInfo.outputPath("embedding-search.png"),
		animations: "disabled",
	});
	// Both collection entry points must preserve the explicitly chosen model.
	await page.goto(`/sources/${sourceId}`);
	await waitForAppHydration(page);
	await page
		.locator(`[data-media-id="${primaryId}"]`)
		.click({ button: "right" });
	await page
		.getByRole("menuitem", {
			name: "類似度検索（EmbeddingGemma 2）",
			exact: true,
		})
		.click();
	await expect(page).toHaveURL(/\/search/);
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_SIMILAR_FILE_NAME) }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toHaveCount(0);
	await page.reload();
	await waitForAppHydration(page);
	const similarMedia = page.getByRole("link", {
		name: new RegExp(E2E_SIMILAR_FILE_NAME),
	});
	await expect(similarMedia).toBeVisible();
	await similarMedia.click({ button: "right" });
	await page
		.getByRole("menuitem", {
			name: "類似度検索（EmbeddingGemma 2）",
			exact: true,
		})
		.click();
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_SIMILAR_FILE_NAME) }),
	).toHaveCount(0);
});
