import { randomUUID } from "node:crypto";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_SIMILAR_FILE_NAME,
	getE2eRuntimeDir,
	getFixtureMediaPath,
} from "./support/fixture";
import { expect, test } from "./support/test";

test("indexes real EmbeddingGemma 2 images and restores natural language and image searches after reload", async ({
	page,
	browserHealth,
}, testInfo) => {
	test.setTimeout(240_000);
	// Leaving Manager and reloading detail intentionally close its job stream;
	// Chromium can report the final abort after the next document has loaded.
	browserHealth.allowRequestFailure(/\/api\/rpc\/jobs\/events(?:\?|$)/);
	const configResponse = await page.request.post("/api/rpc/config/get", {
		data: { json: {} },
	});
	expect(configResponse.ok()).toBe(true);
	const { json: config } = await configResponse.json();
	// Exercise the shared setting explicitly; hardware-specific GPU acceptance
	// is separate from this portable UI/indexing regression.
	const configured = await page.request.post("/api/rpc/config/update", {
		data: { json: { ai: { ...config.ai, provider: "cpu", device: "" } } },
	});
	expect(configured.ok()).toBe(true);
	try {
		const sourceId = randomUUID();
		const sourceName = `Embedding test ${sourceId}`;
		const directory = path.join(getE2eRuntimeDir(), sourceId);
		await mkdir(directory);
		for (const name of [E2E_PRIMARY_FILE_NAME, E2E_SIMILAR_FILE_NAME])
			await copyFile(getFixtureMediaPath(name), path.join(directory, name));
		const created = await page.request.post("/api/rpc/sources/create", {
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
		expect(created.ok()).toBe(true);
		await page.request.post("/api/rpc/sources/sync", {
			data: { json: { id: sourceId } },
		});
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
		await page.goto("/manager");
		await page
			.getByRole("button", { name: /Vector extraction/ })
			.filter({ visible: true })
			.click();
		await expect(
			page.getByRole("button", { name: /^Embedding model/ }),
		).toContainText("EmbeddingGemma 2");
		await page
			.getByRole("button", { name: "All sources", exact: true })
			.click();
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
		await page.getByRole("button", { name: /^検索フィルター/ }).click();
		const sourceSearch = page.getByRole("textbox", {
			name: "自然言語検索（EmbeddingGemma 2）",
		});
		await expect(sourceSearch).toBeVisible();
		await sourceSearch.fill("アニメのキャラクター");
		const sourceSearchResponse = page.waitForResponse(
			(response) =>
				response.url().includes("/api/rpc/media/searchSemantic") &&
				response.status() === 200,
		);
		await page
			.getByRole("button", { name: "文章で画像を検索", exact: true })
			.click();
		await sourceSearchResponse;
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
			.getByRole("button", { name: "文章で画像を検索", exact: true })
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
		await page
			.getByRole("button", { name: "More actions", exact: true })
			.click();
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
		await page.request.post("/api/rpc/sources/delete", {
			data: { json: { id: sourceId } },
		});
		await rm(directory, { recursive: true, force: true });
	} finally {
		await page.request.post("/api/rpc/config/update", {
			data: { json: { ai: config.ai } },
		});
	}
});
