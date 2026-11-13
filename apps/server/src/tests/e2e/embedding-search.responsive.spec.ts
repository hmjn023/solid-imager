import { randomUUID } from "node:crypto";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_SIMILAR_FILE_NAME,
	getE2eRuntimeDir,
	getFixtureMediaPath,
} from "./support/fixture";
import { expect, test as base } from "./support/test";

const test = base.extend<{
	embeddingSource: { sourceId: string; sourceName: string };
}>({
	embeddingSource: async ({ request }, use) => {
		const configResponse = await request.post("/api/rpc/config/get", {
			data: { json: {} },
		});
		await expect(configResponse).toBeOK();
		const { json: config } = await configResponse.json();
		const sourceId = randomUUID();
		const sourceName = `Embedding test ${sourceId}`;
		const directory = path.join(getE2eRuntimeDir(), sourceId);
		try {
			// Run real inference on the portable CPU provider.
			const configured = await request.post("/api/rpc/config/update", {
				data: { json: { ai: { ...config.ai, provider: "cpu", device: "" } } },
			});
			await expect(configured).toBeOK();
			await mkdir(directory);
			try {
				for (const name of [E2E_PRIMARY_FILE_NAME, E2E_SIMILAR_FILE_NAME])
					await copyFile(getFixtureMediaPath(name), path.join(directory, name));
				const created = await request.post("/api/rpc/sources/create", {
					data: {
						json: {
							id: sourceId,
							name: sourceName,
							description: null,
							type: "local",
							connectionInfo: { path: directory },
						},
					},
				});
				await expect(created).toBeOK();
				try {
					const synced = await request.post("/api/rpc/sources/sync", {
						data: { json: { ids: [sourceId] } },
					});
					await expect(synced).toBeOK();
					await use({ sourceId, sourceName });
				} finally {
					const removed = await request.post("/api/rpc/sources/delete", {
						data: { json: { id: sourceId } },
					});
					await expect(removed).toBeOK();
				}
			} finally {
				await rm(directory, { recursive: true, force: true });
			}
		} finally {
			const restored = await request.post("/api/rpc/config/update", {
				data: { json: { ai: config.ai } },
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
	browserHealth.allowRequestFailure(/\/api\/rpc\/jobs\/events(?:\?|$)/);
	const { sourceId, sourceName } = embeddingSource;
	let primaryId = "";
	await expect
		.poll(async () => {
			const response = await page.request.post("/api/rpc/media/search", {
				data: { json: { sourceId, params: { limit: 20, offset: 0 } } },
			});
			const data = await response.json();
			primaryId =
				data.json.media.find(
					(item: { fileName: string }) =>
						item.fileName === E2E_PRIMARY_FILE_NAME,
				)?.id ?? "";
			return data.json.total;
		})
		.toBe(2);
	await page.goto(`/sources/${sourceId}/${primaryId}`);
	await page.getByRole("button", { name: "More actions", exact: true }).click();
	const extractionResponse = page.waitForResponse(
		(response) =>
			response.url().includes("/api/rpc/ai/startEmbeddingExtraction") &&
			response.status() === 200,
	);
	await page
		.getByRole("button", {
			name: "Extract EmbeddingGemma 2 vector",
			exact: true,
		})
		.click();
	const { json: extraction } = await (await extractionResponse).json();
	await expect(
		page.getByText("EmbeddingGemma 2 extraction queued", { exact: true }),
	).toBeVisible();
	await expect
		.poll(
			async () => {
				const response = await page.request.post("/api/rpc/jobs/get", {
					data: { json: { id: extraction.jobId } },
				});
				expect(response.ok()).toBe(true);
				const { json: job } = await response.json();
				expect(job.type).toBe("extract_embedding_vector");
				return job.status;
			},
			{ timeout: 180_000 },
		)
		.toBe("completed");
	await page.goto("/manager");
	await page
		.getByRole("button", { name: /Vector extraction/ })
		.filter({ visible: true })
		.click();
	await expect(
		page.getByRole("button", { name: /^Embedding model/ }),
	).toContainText("EmbeddingGemma 2");
	await page.getByRole("button", { name: /^Target source\b/ }).click();
	await page.getByRole("option", { name: sourceName, exact: true }).click();
	await page
		.getByRole("button", { name: "Start extraction", exact: true })
		.click();
	await expect(
		page.getByText("Batch operation completed successfully.", {
			exact: true,
		}),
	).toBeVisible({ timeout: 180_000 });

	await page.goto(`/sources/${sourceId}`);
	const sourceFilters = page.getByRole("button", { name: /^検索フィルター/ });
	await sourceFilters.click();
	await expect(
		page.getByRole("textbox", { name: "自然言語検索（EmbeddingGemma 2）" }),
	).toBeVisible();
	await sourceFilters.click();
	const sourceSearch = page.locator("#search-composer");
	await expect(sourceSearch).toBeVisible();
	await sourceSearch.fill("text:アニメの キャラクター");
	const sourceSearchResponse = page.waitForResponse(
		(response) =>
			response.url().includes("/api/rpc/media/searchSemantic") &&
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
	const filters = page.getByRole("button", { name: /^検索フィルター、/ });
	await filters.click();
	const dialog = page.getByRole("dialog", {
		name: "検索フィルター",
		exact: true,
	});
	await dialog
		.getByRole("textbox", { name: "自然言語検索（EmbeddingGemma 2）" })
		.fill("アニメのキャラクター");
	await dialog
		.getByRole("button", { name: "文章で画像・動画を検索", exact: true })
		.click();
	await dialog.getByRole("button", { name: "適用", exact: true }).click();
	await expect(
		page.getByRole("button", {
			name: "文章:アニメのキャラクターを解除",
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible();
	await page.reload();
	await expect(
		page.getByRole("button", {
			name: "文章:アニメのキャラクターを解除",
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible();
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
	const relatedMedia = page.getByRole("region", {
		name: "関連メディア",
		exact: true,
	});
	await relatedMedia.scrollIntoViewIfNeeded();
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
	await page.getByRole("button", { name: "More actions", exact: true }).click();
	await page
		.getByRole("button", {
			name: "Find similar (EmbeddingGemma 2)",
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
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_SIMILAR_FILE_NAME) }),
	).toBeVisible();
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
