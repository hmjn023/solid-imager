import {
	apiPathPattern,
	apiRequest,
	apiRequestMatches,
	apiResponse,
} from "./support/api";
import { readdir, readFile } from "node:fs/promises";
import { mediaThumbnailPath } from "@solid-imager/core/http";
import { pendingImportJobSchema } from "@solid-imager/core/media";
import { generateMediaFilename } from "@solid-imager/core/media/files";
import {
	E2E_SOURCE_ID,
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	getE2eMediaDir,
	getFixtureMediaPath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

test("opens a batch, pages past 25 targets and restores its details after reload", async ({
	page,
	browserHealth,
}) => {
	// SSE invalidation supersedes in-flight reads of these same two queries.
	for (const operation of ["jobs/list", "jobs/targets", "jobs/types"]) {
		browserHealth.allowRequestFailure(
			apiPathPattern(operation),
			"net::ERR_ABORTED",
		);
	}
	const filenames = Array.from({ length: 26 }, (_, i) =>
		i === 0 ? E2E_PRIMARY_FILE_NAME : `batch-target-${i}.png`,
	);
	// The first dev navigation compiles the route before opening the stream.
	const subscribed = page.waitForRequest(apiRequestMatches("jobs/events"), {
		timeout: 60_000,
	});
	await page.goto("/jobs", { waitUntil: "domcontentloaded", timeout: 60_000 });
	await waitForAppHydration(page);
	await subscribed;
	const response = await apiRequest(page.request, "media/reserveUploads", {
		sourceId: E2E_SOURCE_ID,
		filenames,
	});
	expect(response.ok()).toBe(true);
	const { jobId, reservations } = await response.json();
	await page
		.getByRole("button", { name: new RegExp(jobId) })
		.filter({ visible: true })
		.click();
	await expect(page).toHaveURL(
		(url) => url.searchParams.get("jobId") === jobId,
	);
	const table = page
		.getByRole("table", { name: /バッチの処理対象|Batch targets/i })
		.filter({ visible: true });
	const stages = page.getByRole("region", {
		name: /工程別の進捗|Progress by stage/i,
	});
	const uploadProgress = stages.getByRole("progressbar", {
		name: /アップロード|Upload/i,
	});
	await expect(uploadProgress).toHaveAttribute("aria-valuenow", "0");
	await expect(stages).toContainText(/待機 26|Queued 26/);
	const upload = await page.request.post(
		`/api/sources/${E2E_SOURCE_ID}/media`,
		{
			multipart: {
				reservationId: reservations[0],
				filename: E2E_PRIMARY_FILE_NAME,
				file: {
					name: E2E_PRIMARY_FILE_NAME,
					mimeType: "image/png",
					buffer: await readFile(getFixtureMediaPath(E2E_PRIMARY_FILE_NAME)),
				},
			},
		},
	);
	expect(upload.ok()).toBe(true);
	// The upload came from a separate API client. The open inspector updates via SSE.
	await expect(uploadProgress).toHaveAttribute("aria-valuenow", "4");
	await expect(stages).toContainText(/待機 25|Queued 25/);
	await expect(table.getByRole("row")).toHaveCount(26);
	const firstPage = await table
		.locator("tbody tr td:nth-child(2) > span")
		.allTextContents();
	await page
		.locator("section")
		.filter({ has: table })
		.getByRole("button", { name: /^(次へ|次|Next)$/i })
		.last()
		.click();
	await expect(table.getByRole("row")).toHaveCount(2);
	await expect(stages).toContainText(/待機 25|Queued 25/);
	const last = await table
		.locator("tbody tr td:nth-child(2) > span")
		.innerText();
	expect([...firstPage, last].sort()).toEqual(filenames.sort());
	await page.reload();
	await waitForAppHydration(page);
	await expect(table.getByRole("row")).toHaveCount(26);
	await expect(uploadProgress).toBeVisible();
	await page
		.getByRole("button", {
			name: /一括取り込みをキャンセル|Cancel batch import/i,
		})
		.filter({ visible: true })
		.click();
	await expect(uploadProgress).toHaveAttribute("aria-valuenow", "100");
	await expect(stages).toContainText(/キャンセル 25件|Cancelled: 25/);
	const cancelledRow = table
		.locator("tbody tr")
		.filter({ hasText: /キャンセル|cancelled/i })
		.first();
	await expect(cancelledRow).toBeVisible();
	await page.reload();
	await waitForAppHydration(page);
	await expect(cancelledRow).toBeVisible();
});

test("saves one file when the same Pixiv item is approved twice in a batch", async ({
	baseURL,
	request,
}) => {
	if (!baseURL) throw new Error("Expected the isolated test server URL");
	const targetUrl = new URL(
		mediaThumbnailPath(E2E_SOURCE_ID, E2E_PRIMARY_MEDIA_ID),
		baseURL,
	).href;
	const description = `duplicate-import-${crypto.randomUUID()}`;
	const item = {
		targetUrl,
		sourceUrls: [targetUrl, `https://www.pixiv.net/artworks/${Date.now()}`],
		description,
	};
	for (let index = 0; index < 2; index++) {
		const added = await apiRequest(request, "imports/bulkAdd", {
			items: [item],
		});
		expect(added.ok()).toBe(true);
		expect(await added.json()).toMatchObject({ addedCount: 1 });
	}
	const pending = await apiRequest(request, "imports/listPending");
	expect(pending.ok()).toBe(true);
	const requests = pendingImportJobSchema.array().parse(await pending.json());
	const jobIds = requests
		.filter((job) => job.item.description === description)
		.map((job) => job.id);
	expect(jobIds).toHaveLength(2);
	const approved = await apiRequest(request, "imports/process", {
		jobIds,
		targetSourceId: E2E_SOURCE_ID,
	});
	expect(approved.ok()).toBe(true);
	const { batchId, processedCount } = await approved.json();
	expect(processedCount).toBe(2);
	expect(batchId).toBeTruthy();
	await expect
		.poll(async () =>
			(await apiRequest(request, "jobs/get", { id: batchId })).json(),
		)
		.toMatchObject({
			status: "completed",
			progress: { processed: 1, failed: 0, total: 1 },
		});
	const stem = generateMediaFilename(item, "");
	const files = await readdir(getE2eMediaDir());
	expect(files.filter((file) => file.startsWith(stem))).toHaveLength(1);
});

test("retries a failed upload from the parent and replaces only its file", async ({
	page,
	request,
	browserHealth,
}) => {
	for (const operation of ["jobs/list", "jobs/targets", "jobs/types"]) {
		browserHealth.allowRequestFailure(
			apiPathPattern(operation),
			"net::ERR_ABORTED",
		);
	}
	const name = `retry-${crypto.randomUUID()}.png`;
	const good = await readFile(getFixtureMediaPath(E2E_PRIMARY_FILE_NAME));
	const reserved = await apiRequest(request, "media/reserveUploads", {
		sourceId: E2E_SOURCE_ID,
		filenames: [E2E_PRIMARY_FILE_NAME, name],
	});
	expect(reserved.ok()).toBe(true);
	const { jobId, reservations } = await reserved.json();
	const send = (filename: string, reservationId: string, buffer: Buffer) =>
		request.post(`/api/sources/${E2E_SOURCE_ID}/media`, {
			multipart: {
				reservationId,
				file: { name: filename, mimeType: "image/png", buffer },
			},
		});
	expect((await send(E2E_PRIMARY_FILE_NAME, reservations[0], good)).ok()).toBe(
		true,
	);
	expect(
		(await send(name, reservations[1], Buffer.from("invalid image"))).ok(),
	).toBe(false);
	await page.goto(`/jobs?jobId=${jobId}`);
	await waitForAppHydration(page);
	const retry = page
		.getByRole("button", { name: /失敗した工程を再実行|Retry failed stages/i })
		.filter({ visible: true });
	await expect(retry).toBeVisible();
	const response = page.waitForResponse(
		(res) => apiResponse("jobs/retry")(res) && res.ok(),
	);
	await retry.click();
	await response;
	const failedAttempt = async () =>
		await (
			await apiRequest(request, "jobs/get", { id: reservations[1] })
		).json();
	await expect
		.poll(failedAttempt)
		.toMatchObject({ status: "failed", attemptCount: 2 });
	await page.reload();
	await waitForAppHydration(page);
	await page
		.getByLabel(new RegExp(name))
		.filter({ visible: true })
		.setInputFiles({ name, mimeType: "image/png", buffer: good });
	const parent = async () =>
		await (await apiRequest(request, "jobs/get", { id: jobId })).json();
	await expect.poll(parent, { timeout: 60000 }).toMatchObject({
		status: "completed",
		progress: { processed: 2, failed: 0, total: 2 },
	});
	expect(
		await (
			await apiRequest(request, "jobs/get", { id: reservations[0] })
		).json(),
	).toMatchObject({ status: "completed", attemptCount: 1 });
});
