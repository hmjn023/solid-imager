import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import type { JobDto } from "@solid-imager/core/jobs";
import {
	E2E_SOURCE_ID,
	E2E_SOURCE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_PRIMARY_FILE_NAME,
	E2E_SIMILAR_MEDIA_ID,
	E2E_SIMILAR_FILE_NAME,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

function gate() {
	let release: () => void = () => {};
	const promise = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { promise, release };
}
async function category(page: Page, name: string) {
	await page
		.getByRole("button", { name: new RegExp(`^${name}`) })
		.filter({ visible: true })
		.click();
}
function snapshot(id: string, values: Partial<JobDto> = {}): JobDto {
	return {
		id,
		type: "extract_embedding_batch",
		mediaSourceId: null,
		status: "in_progress",
		progress: { processed: 1, failed: 0, total: 4 },
		createdAt: new Date(),
		updatedAt: new Date(),
		parentId: null,
		error: null,
		cancelRequestedAt: null,
		cancelledAt: null,
		attemptCount: 1,
		startedAt: new Date(),
		finishedAt: null,
		targetMediaId: null,
		targetMediaModifiedAt: null,
		artifact: null,
		...values,
	};
}

test("keeps the selected batch's read error when an earlier tracked GET finishes late", async ({
	page,
	browserHealth,
}) => {
	const oldId = randomUUID();
	const selectedId = randomUUID();
	let oldReadRequested = false;
	const releaseOld = gate();
	browserHealth.allowResponseFailure(/\/api\/rpc\/jobs\/get(?:\?|$)/);
	browserHealth.allowConsole(/Failed to load resource:.*503/);
	await page.route("**/api/rpc/jobs/activeBatches", (route) =>
		route.fulfill({ json: { json: [snapshot(selectedId)] } }),
	);
	await page.route("**/api/rpc/ai/startBatchTagging", (route) =>
		route.fulfill({
			json: {
				json: { success: true, jobId: oldId, message: "Started old batch" },
			},
		}),
	);
	await page.route(/\/api\/rpc\/jobs\/get(?:\?|$)/, async (route) => {
		if (
			route.request().url().includes(oldId) ||
			route.request().postData()?.includes(oldId)
		) {
			oldReadRequested = true;
			await releaseOld.promise;
			await route.fulfill({ json: { json: snapshot(oldId) } });
		} else
			await route.fulfill({
				status: 503,
				json: {
					defined: false,
					code: "SERVICE_UNAVAILABLE",
					status: 503,
					message: "Selected batch unavailable",
				},
			});
	});
	await page.goto("/manager");
	await waitForAppHydration(page);
	await category(page, "一括タグ付け");
	await page
		.getByRole("button", { name: "タグ付けを開始", exact: true })
		.click();
	await expect.poll(() => oldReadRequested).toBe(true);
	await page.getByRole("button", { name: "進捗を確認", exact: true }).click();
	const error = page.getByText(/^一括処理の進捗を更新できませんでした:/);
	await expect(error).toBeVisible();
	const oldResponse = page.waitForResponse(
		(response) =>
			response.url().includes("/api/rpc/jobs/get") &&
			(response.url().includes(oldId) ||
				response.request().postData()?.includes(oldId) === true),
	);
	releaseOld.release();
	await (await oldResponse).finished();
	await page.evaluate(
		() =>
			new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
	);
	await expect(error).toBeVisible();
	const savedId = await page.evaluate(
		() =>
			JSON.parse(
				sessionStorage.getItem("solid-imager:manager:batch-run") ?? "{}",
			).jobId,
	);
	expect(savedId).toBe(selectedId);
});

test("retains pending submissions across tabs and restores the latest requested batch after out-of-order responses", async ({
	page,
}) => {
	const firstId = randomUUID();
	const latestId = randomUUID();
	const submitted = gate();
	const delayed = gate();
	const delivered = gate();
	await page.route("**/api/rpc/ai/startBatchTagging", async (route) => {
		submitted.release();
		await delayed.promise;
		await route.fulfill({
			json: {
				json: { success: true, jobId: firstId, message: "First submitted" },
			},
		});
		delivered.release();
	});
	await page.route("**/api/rpc/ai/startBatchEmbeddingExtraction", (route) =>
		route.fulfill({
			json: {
				json: { success: true, jobId: latestId, message: "Latest submitted" },
			},
		}),
	);
	await page.route(/\/api\/rpc\/jobs\/get(?:\?|$)/, (route) =>
		route.fulfill({ json: { json: snapshot(latestId) } }),
	);
	await page.goto("/manager");
	await waitForAppHydration(page);
	await category(page, "一括タグ付け");
	await page
		.getByRole("button", { name: "タグ付けを開始", exact: true })
		.click();
	await submitted.promise;
	await category(page, "ベクトル抽出");
	await category(page, "一括タグ付け");
	await expect(
		page.getByRole("button", { name: "登録中...", exact: true }),
	).toBeDisabled();
	await category(page, "ベクトル抽出");
	await page.getByRole("button", { name: "抽出を開始", exact: true }).click();
	const savedId = () =>
		page.evaluate(() => {
			const raw = sessionStorage.getItem("solid-imager:manager:batch-run");
			return raw ? JSON.parse(raw).jobId : null;
		});
	await expect.poll(savedId).toBe(latestId);
	delayed.release();
	await delivered.promise;
	await expect(
		page.getByText("First submitted", { exact: true }),
	).toBeVisible();
	expect(await savedId()).toBe(latestId);
	await page.reload();
	await expect(
		page.getByRole("heading", { name: "ベクトル抽出", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("progressbar", { name: "一括処理の進捗" }),
	).toHaveAttribute("aria-valuenow", "25");
});

test("shows a new target scan separately from the previous completed batch", async ({
	page,
}) => {
	const id = randomUUID();
	await page.route("**/api/rpc/ai/startBatchTagging", (route) =>
		route.fulfill({
			json: { json: { success: true, jobId: id, message: "Batch queued" } },
		}),
	);
	await page.route("**/api/rpc/ai/scanBatchTaggingTargets", (route) =>
		route.fulfill({ json: { json: { count: 3 } } }),
	);
	await page.route(/\/api\/rpc\/jobs\/get(?:\?|$)/, (route) =>
		route.fulfill({
			json: {
				json: snapshot(id, {
					type: "bulk_tagging_parent",
					status: "completed",
					progress: { processed: 4, failed: 0, total: 4 },
				}),
			},
		}),
	);
	await page.goto("/manager");
	await waitForAppHydration(page);
	await category(page, "一括タグ付け");
	await page
		.getByRole("button", { name: "タグ付けを開始", exact: true })
		.click();
	await expect(
		page.getByText("一括操作が完了しました。", { exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "対象を確認", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "対象の確認", exact: true }),
	).toBeVisible();
	await expect(
		page.getByText("3件見つかりました。", { exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("progressbar", { name: "一括処理の進捗" }),
	).toHaveCount(0);
	await expect(page.getByText("完了", { exact: true })).toHaveCount(0);
});

test("drops a duplicate scan after scope change and confirms the actual source and delete IDs", async ({
	page,
}) => {
	const submitted = gate();
	const delayed = gate();
	const delivered = gate();
	let scans = 0;
	const groups = [
		{
			id: "fixture",
			reason: "sourceUrl",
			media: [
				{ id: E2E_PRIMARY_MEDIA_ID, fileName: E2E_PRIMARY_FILE_NAME },
				{ id: E2E_SIMILAR_MEDIA_ID, fileName: E2E_SIMILAR_FILE_NAME },
			].map((item, index) => ({
				...item,
				mediaSourceId: E2E_SOURCE_ID,
				filePath: item.fileName,
				fileSize: 100,
				width: 1,
				height: 1,
				mediaType: "image",
				createdAt: new Date(index + 1),
				modifiedAt: new Date(index + 1),
				sourceUrls: [],
			})),
		},
	];
	await page.route(
		/\/api\/rpc\/media\/findDuplicates(?:\?|$)/,
		async (route) => {
			scans++;
			if (scans === 1) {
				submitted.release();
				await delayed.promise;
			}
			await route.fulfill({ json: { json: { groups } } });
			if (scans === 1) delivered.release();
		},
	);
	const deletions: object[] = [];
	await page.route("**/api/rpc/media/bulkDelete", async (route) => {
		deletions.push(route.request().postDataJSON());
		await route.fulfill({ json: { json: { success: true } } });
	});
	await page.goto("/manager");
	await waitForAppHydration(page);
	await category(page, "重複検出");
	await page.getByRole("button", { name: /^対象ソース / }).click();
	await page
		.getByRole("option", { name: E2E_SOURCE_NAME, exact: true })
		.click();
	await page.getByRole("button", { name: "重複を検出", exact: true }).click();
	await submitted.promise;
	await page.getByRole("button", { name: /^対象ソース / }).click();
	await page
		.getByRole("option", { name: "すべてのソース", exact: true })
		.click();
	delayed.release();
	await delivered.promise;
	await expect(
		page.getByRole("button", { name: "重複を検出", exact: true }),
	).toBeEnabled();
	await expect(
		page.getByRole("button", { name: "1件を削除", exact: true }),
	).toHaveCount(0);
	await page.getByRole("button", { name: "重複を検出", exact: true }).click();
	await page.getByRole("button", { name: "1件を削除", exact: true }).click();
	const confirmation = page.getByRole("alertdialog");
	await expect(confirmation).toContainText(
		`${E2E_SOURCE_NAME} / ${E2E_SIMILAR_FILE_NAME}`,
	);
	await confirmation
		.getByRole("button", { name: "1件を削除", exact: true })
		.click();
	await expect
		.poll(() => deletions)
		.toEqual([
			{
				json: {
					mediaSourceId: E2E_SOURCE_ID,
					mediaIds: [E2E_SIMILAR_MEDIA_ID],
				},
			},
		]);
	await expect(confirmation).toBeHidden();
});
