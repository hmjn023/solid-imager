import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { jobStatusSchema } from "@solid-imager/core/jobs";
import {
	mediaDumpItemSchema,
	mediaSearchResponseSchema,
} from "@solid-imager/core/media";
import { z } from "zod";
import {
	E2E_PRIMARY_FILE_NAME,
	getE2eRuntimeDir,
	getFixtureMediaPath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

const run = promisify(execFile);
const restoreJobSchema = z.object({
	id: z.uuid(),
	type: z.literal("source_restore"),
	mediaSourceId: z.uuid(),
	status: jobStatusSchema,
	error: z.string().nullable(),
});

test("restores an archive's original media and metadata into the selected source", async ({
	page,
	request,
}) => {
	const root = await mkdtemp(path.join(getE2eRuntimeDir(), "restore-"));
	const destination = path.join(root, "destination");
	const contents = path.join(root, "contents");
	const archive = path.join(root, "restore.tar");
	const sourceId = randomUUID();
	const sourceName = `Restore destination ${sourceId}`;
	const fileName = "restored-image.png";
	const description = "Description supplied by the restore archive";
	let sourceCreated = false;
	try {
		const images = path.join(contents, "images");
		await mkdir(images, { recursive: true });
		await mkdir(destination);
		const original = await readFile(getFixtureMediaPath(E2E_PRIMARY_FILE_NAME));
		const record = mediaDumpItemSchema.parse({
			filePath: fileName,
			fileName,
			description,
			mediaType: "image",
			width: 256,
			height: 256,
			fileSize: original.byteLength,
		});
		await writeFile(
			path.join(contents, "dump.ndjson"),
			`${JSON.stringify(record)}\n`,
		);
		await writeFile(path.join(images, fileName), original);
		await run("tar", ["-cf", archive, "-C", contents, "dump.ndjson", "images"]);

		const created = await request.post("/api/rpc/sources/create", {
			data: {
				json: {
					id: sourceId,
					name: sourceName,
					description: null,
					type: "local",
					connectionInfo: { path: destination },
				},
			},
		});
		await expect(created).toBeOK();
		sourceCreated = true;

		await page.goto("/manager");
		await waitForAppHydration(page);
		await page
			.locator('nav[aria-label="管理カテゴリ"]:visible')
			.getByRole("button", { name: /データ転送/ })
			.first()
			.click();
		await page.getByRole("button", { name: /^保存先ソース/ }).click();
		await page.getByRole("option", { name: sourceName, exact: true }).click();
		await page.getByRole("button", { name: /^復元形式/ }).click();
		await page
			.getByRole("option", { name: "TARアーカイブ", exact: true })
			.click();

		const queued = page.waitForResponse(
			(response) =>
				new URL(response.url()).pathname === "/api/rpc/sources/enqueueImport",
		);
		const chooser = page.waitForEvent("filechooser");
		await page
			.getByRole("button", { name: "ダンプファイルを選択", exact: true })
			.click();
		await (await chooser).setFiles(archive);
		const response = await queued;
		expect(response.ok(), await response.text()).toBe(true);
		const job = z
			.object({ json: restoreJobSchema })
			.parse(await response.json()).json;
		expect(job.mediaSourceId).toBe(sourceId);
		await expect(
			page.getByText(
				`復元を登録しました（${job.id.slice(0, 8)}）。ジョブ画面で確認できます。`,
			),
		).toBeVisible();

		const getJob = async () => {
			const result = await request.post("/api/rest/jobs/get", {
				data: { id: job.id },
			});
			await expect(result).toBeOK();
			return restoreJobSchema.parse(await result.json());
		};
		await expect
			.poll(async () => (await getJob()).status)
			.toMatch(/^(completed|failed|cancelled)$/);
		const finished = await getJob();
		expect(finished.status, finished.error ?? "Restore job status").toBe(
			"completed",
		);

		expect(await readFile(path.join(destination, fileName))).toEqual(original);
		const listing = await request.post("/api/rpc/media/search", {
			data: { json: { sourceId, params: { limit: 20, offset: 0 } } },
		});
		await expect(listing).toBeOK();
		const restored = mediaSearchResponseSchema.parse(
			(await listing.json()).json,
		);
		expect(restored.total).toBe(1);
		expect(restored.media[0]).toMatchObject({
			fileName,
			mediaSourceId: sourceId,
			description,
			fileSize: original.byteLength,
		});
	} finally {
		if (sourceCreated) {
			const deleted = await request.post("/api/rpc/sources/delete", {
				data: { json: { id: sourceId } },
			});
			await expect(deleted).toBeOK();
		}
		await rm(root, { recursive: true, force: true });
	}
});
