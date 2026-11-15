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
		/\/api\/rpc\/jobs\/(list|targets)$/,
		"net::ERR_ABORTED",
	);
	const filenames = Array.from(
		{ length: 26 },
		(_, i) => `batch-target-${i}.png`,
	);
	const subscribed = page.waitForRequest((request) =>
		request.url().endsWith("/jobs/events"),
	);
	await page.goto("/jobs");
	await waitForAppHydration(page);
	await subscribed;
	const response = await page.request.post("/api/rpc/media/reserveUploads", {
		data: { json: { sourceId: E2E_SOURCE_ID, filenames } },
	});
	expect(response.ok()).toBe(true);
	const {
		json: { jobId },
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
	await expect(table.getByRole("row")).toHaveCount(26);
	const firstPage = await table
		.locator("tbody tr td:first-child")
		.allTextContents();
	await page
		.locator("section")
		.filter({ has: table })
		.getByRole("button", { name: /^(次へ|次|Next)$/i })
		.last()
		.click();
	await expect(table.getByRole("row")).toHaveCount(2);
	const last = await table.locator("tbody tr td:first-child").innerText();
	expect([...firstPage, last].sort()).toEqual(filenames.sort());
	await page.reload();
	await waitForAppHydration(page);
	await expect(table.getByRole("row")).toHaveCount(26);
	await page
		.getByRole("button", {
			name: /一括取り込みをキャンセル|Cancel batch import/i,
		})
		.filter({ visible: true })
		.click();
	await expect(table.locator("tbody tr").first()).toContainText(
		/キャンセル|cancelled/i,
	);
	await page.reload();
	await waitForAppHydration(page);
	await expect(table.locator("tbody tr").first()).toContainText(
		/キャンセル|cancelled/i,
	);
});

test("retries a failed upload from the parent and replaces only its file", async ({
	page,
	request,
	browserHealth,
}) => {
	browserHealth.allowRequestFailure(
		/\/api\/rpc\/jobs\/(list|targets)$/,
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
