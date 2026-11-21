import { readFile } from "node:fs/promises";
import {
	E2E_SOURCE_ID,
	E2E_PRIMARY_FILE_NAME,
	getFixtureMediaPath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

test("opens a batch, pages past 25 targets and restores its details after reload", async ({
	page,
	browserHealth,
}) => {
	// SSE invalidation supersedes in-flight reads of these same two queries.
	browserHealth.allowRequestFailure(
		/\/api\/rpc\/jobs\/(list|targets|types)$/,
		"net::ERR_ABORTED",
	);
	const filenames = Array.from({ length: 26 }, (_, i) =>
		i === 0 ? E2E_PRIMARY_FILE_NAME : `batch-target-${i}.png`,
	);
	// The first dev navigation compiles the route before opening the stream.
	const subscribed = page.waitForRequest(
		(request) => request.url().endsWith("/jobs/events"),
		{ timeout: 60_000 },
	);
	await page.goto("/jobs", { waitUntil: "domcontentloaded", timeout: 60_000 });
	await waitForAppHydration(page);
	await subscribed;
	const response = await page.request.post("/api/rpc/media/reserveUploads", {
		data: { json: { sourceId: E2E_SOURCE_ID, filenames } },
	});
	expect(response.ok()).toBe(true);
	const {
		json: { jobId, reservations },
	} = await response.json();
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
	const upload = await page.request.post("/api/rest/media/upload", {
		multipart: {
			sourceId: E2E_SOURCE_ID,
			reservationId: reservations[0],
			filename: E2E_PRIMARY_FILE_NAME,
			file: {
				name: E2E_PRIMARY_FILE_NAME,
				mimeType: "image/png",
				buffer: await readFile(getFixtureMediaPath(E2E_PRIMARY_FILE_NAME)),
			},
		},
	});
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

test("retries a failed upload from the parent and replaces only its file", async ({
	page,
	request,
	browserHealth,
}) => {
	browserHealth.allowRequestFailure(
		/\/api\/rpc\/jobs\/(list|targets|types)$/,
		"net::ERR_ABORTED",
	);
	const name = `retry-${crypto.randomUUID()}.png`;
	const good = await readFile(getFixtureMediaPath(E2E_PRIMARY_FILE_NAME));
	const reserved = await request.post("/api/rest/media/reserveUploads", {
		data: { sourceId: E2E_SOURCE_ID, filenames: [E2E_PRIMARY_FILE_NAME, name] },
	});
	expect(reserved.ok()).toBe(true);
	const { jobId, reservations } = await reserved.json();
	const send = (filename: string, reservationId: string, buffer: Buffer) =>
		request.post("/api/rest/media/upload", {
			multipart: {
				sourceId: E2E_SOURCE_ID,
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
		(res) => res.url().includes("/jobs/retry") && res.ok(),
	);
	await retry.click();
	await response;
	const failedAttempt = async () =>
		await (
			await request.post("/api/rest/jobs/get", {
				data: { id: reservations[1] },
			})
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
		await (
			await request.post("/api/rest/jobs/get", { data: { id: jobId } })
		).json();
	await expect.poll(parent, { timeout: 60000 }).toMatchObject({
		status: "completed",
		progress: { processed: 2, failed: 0, total: 2 },
	});
	expect(
		await (
			await request.post("/api/rest/jobs/get", {
				data: { id: reservations[0] },
			})
		).json(),
	).toMatchObject({ status: "completed", attemptCount: 1 });
});
