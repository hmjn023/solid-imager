import { randomUUID } from "node:crypto";
import { createRouterClient } from "@orpc/server";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { jobsRouter } from "~/infrastructure/api/routers/jobs-router";
import { downloadsRouter } from "~/infrastructure/api/routers/downloads-router";
import { sourceRunsRouter } from "~/infrastructure/api/routers/source-runs-router";
import { SourceRunRepository } from "~/infrastructure/repositories/source-run-repository";
import { db } from "~/infrastructure/db";
import {
	batchRuns,
	batchItems,
	downloadRuns,
	sourceSyncRuns,
	sourceTransferRuns,
	jobHistoryDismissals,
	mediaSources,
} from "~/infrastructure/db/schema";
import { services } from "~/infrastructure/service-registry";
import { batchRunService } from "~/infrastructure/services/batch-run-service";
import { findFailedRetryCandidates } from "~/infrastructure/repositories/failed-job-retry-repository";
import type {
	BatchItem,
	BatchRun,
} from "@solid-imager/core/domain/batches/schemas";

describe("Jobs cancellation and history removal", () => {
	const client = createRouterClient(jobsRouter);
	const ids: string[] = [];
	const sourceIds: string[] = [];
	beforeAll(async () => {
		await services.getJobWorker().stop();
		await batchRunService.initialize();
	});
	afterEach(async () => {
		for (const table of [
			jobHistoryDismissals,
			batchRuns,
			downloadRuns,
			sourceSyncRuns,
			sourceTransferRuns,
		])
			if (ids.length) await db.delete(table).where(inArray(table.id, ids));
		ids.length = 0;
		if (sourceIds.length)
			await db.delete(mediaSources).where(inArray(mediaSources.id, sourceIds));
		sourceIds.length = 0;
	});
	async function batch(
		status: BatchRun["status"],
		statuses: BatchItem["status"][],
	) {
		const [run] = await db
			.insert(batchRuns)
			.values({
				status,
				dispatchComplete: status !== "pending",
				input: {
					kind: "thumbnail",
					force: false,
					missingOnly: false,
					thumbnailSize: 512,
				},
			})
			.returning();
		ids.push(run.id);
		const items = await db
			.insert(batchItems)
			.values(
				statuses.map((status) => ({
					runId: run.id,
					mediaId: randomUUID(),
					mediaSourceId: randomUUID(),
					kind: "thumbnail" as const,
					status,
				})),
			)
			.returning();
		return { run, items };
	}
	it("requires cancelling an active batch before removing parent and child history", async () => {
		const { run, items } = await batch("pending", ["pending", "completed"]);
		expect((await client.get({ id: items[0].id })).canCancel).toBe(true);
		expect((await client.get({ id: items[1].id })).canDelete).toBe(false);
		await expect(client.delete({ id: items[1].id })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		expect(
			await db
				.select()
				.from(jobHistoryDismissals)
				.where(eq(jobHistoryDismissals.id, run.id)),
		).toHaveLength(0);
		expect((await client.cancel({ id: items[0].id })).status).toBe("cancelled");
		expect((await client.get({ id: run.id })).status).toBe("cancelled");
		const before = await db
			.select()
			.from(batchItems)
			.where(eq(batchItems.runId, run.id));
		expect(before.map((item) => item.status).sort()).toEqual([
			"cancelled",
			"completed",
		]);
		await client.delete({ id: items[0].id });
		await client.delete({ id: run.id }); // Idempotent even when both parent and children were selected.
		expect(
			await db.select().from(batchItems).where(eq(batchItems.runId, run.id)),
		).toEqual(before);
		for (const status of [undefined, "cancelled", "completed"] as const) {
			const page = await client.list({ status, limit: 200, offset: 0 });
			expect(
				page.items.some((job) => job.id === run.id || job.parentId === run.id),
			).toBe(false);
		}
		await expect(client.get({ id: run.id })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		await expect(client.get({ id: items[0].id })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		// An explicit retry from an older open page restores visibility and keeps successes.
		await client.retry({ id: run.id });
		expect((await client.get({ id: run.id })).status).toBe("pending");
		expect(
			(
				await db.select().from(batchItems).where(eq(batchItems.id, items[1].id))
			)[0].status,
		).toBe("completed");
	});
	it("removes history before pagination and excludes dismissed failures from retry-all", async () => {
		const hidden = await batch("failed", ["failed"]);
		const visible = await batch("failed", ["failed"]);
		await client.delete({ id: hidden.run.id });
		const page = await client.list({ status: "failed", limit: 1, offset: 0 });
		expect(page.total).toBe(2);
		expect(page.items).toHaveLength(1);
		expect(
			page.items[0].id === visible.run.id ||
				page.items[0].parentId === visible.run.id,
		).toBe(true);
		const candidates = await findFailedRetryCandidates({});
		expect(
			candidates.candidates.map((candidate) => candidate.id),
		).not.toContain(hidden.run.id);
		expect(candidates.candidates.map((candidate) => candidate.id)).toContain(
			visible.run.id,
		);
	});
	it("keeps download and source execution records intact when their history is removed", async () => {
		const [download] = await db
			.insert(downloadRuns)
			.values({ requestKey: randomUUID(), status: "failed" })
			.returning();
		const [sync] = await db
			.insert(sourceSyncRuns)
			.values({ kind: "sync", status: "completed" })
			.returning();
		const [transfer] = await db
			.insert(sourceTransferRuns)
			.values({ kind: "export", status: "cancelled" })
			.returning();
		ids.push(download.id, sync.id, transfer.id);
		for (const id of ids) {
			expect((await client.get({ id })).canDelete).toBe(true);
			await client.delete({ id });
			await expect(client.get({ id })).rejects.toMatchObject({
				code: "NOT_FOUND",
			});
		}
		expect(
			(await client.list({ limit: 200, offset: 0 })).items.some((job) =>
				ids.includes(job.id),
			),
		).toBe(false);
		expect(
			(
				await db
					.select()
					.from(downloadRuns)
					.where(eq(downloadRuns.id, download.id))
			)[0],
		).toEqual(download);
		expect(
			(
				await db
					.select()
					.from(sourceSyncRuns)
					.where(eq(sourceSyncRuns.id, sync.id))
			)[0],
		).toEqual(sync);
		expect(
			(
				await db
					.select()
					.from(sourceTransferRuns)
					.where(eq(sourceTransferRuns.id, transfer.id))
			)[0],
		).toEqual(transfer);
		await expect(client.delete({ id: randomUUID() })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});
	it("restores visibility when dedicated download and source retry APIs are used", async () => {
		const source = await services.getSourceRepository().create({
			name: "History retry fixture",
			type: "local",
			description: null,
			connectionInfo: { path: "/history-retry-fixture" },
		});
		sourceIds.push(source.id);
		const downloads = createRouterClient(downloadsRouter);
		const download = await downloads.start({
			mediaSourceId: source.id,
			items: [{ targetUrl: `https://example.invalid/${randomUUID()}.png` }],
		});
		const transfer = await SourceRunRepository.createTransfer(source.id, {
			kind: "export",
			mode: "ndjson",
			includeImages: false,
			sourceRevision: "fixture",
		});
		ids.push(...download.runIds, transfer.id);
		await db
			.update(downloadRuns)
			.set({ status: "failed" })
			.where(eq(downloadRuns.id, download.runIds[0]));
		await db
			.update(sourceTransferRuns)
			.set({ status: "failed" })
			.where(eq(sourceTransferRuns.id, transfer.id));
		for (const id of ids) await client.delete({ id });
		await downloads.retry({ id: download.runIds[0] });
		await createRouterClient(sourceRunsRouter).retry({ id: transfer.id });
		for (const id of ids)
			expect((await client.get({ id })).status).toBe("pending");
	});
});
