import { randomUUID } from "node:crypto";
import { createRouterClient } from "@orpc/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import type {
	BatchItem,
	BatchRun,
} from "@solid-imager/core/domain/batches/schemas";
import type { JobRetryFailedRequest } from "@solid-imager/core/domain/jobs/schemas";
import { ResourceConflictError } from "@solid-imager/core/domain/errors";
import { jobsRouter } from "~/infrastructure/api/routers/jobs-router";
import { services } from "~/infrastructure/service-registry";
import { db } from "~/infrastructure/db";
import {
	batchRuns,
	batchItems,
	jobs,
	downloadRuns,
	mediaSources,
	sourceTransferRuns,
} from "~/infrastructure/db/schema";
import { downloadsRouter } from "~/infrastructure/api/routers/downloads-router";
import { SourceRunRepository } from "~/infrastructure/repositories/source-run-repository";
import { batchRunService } from "~/infrastructure/services/batch-run-service";

describe("retry all failed execution owners", () => {
	const client = createRouterClient(jobsRouter);
	const created: string[] = [];
	const sources: string[] = [];
	beforeAll(async () => {
		await services.getJobWorker().stop();
		await batchRunService.initialize();
	});
	afterEach(async () => {
		vi.restoreAllMocks();
		if (created.length)
			await db.delete(batchRuns).where(inArray(batchRuns.id, created));
		created.length = 0;
		if (sources.length) {
			await db
				.delete(downloadRuns)
				.where(inArray(downloadRuns.mediaSourceId, sources));
			await db
				.delete(sourceTransferRuns)
				.where(inArray(sourceTransferRuns.sourceId, sources));
			await db.delete(mediaSources).where(inArray(mediaSources.id, sources));
		}
		sources.length = 0;
	});
	async function batch(
		statuses: BatchItem["status"][],
		status: BatchRun["status"] = "failed",
	) {
		const [run] = await db
			.insert(batchRuns)
			.values({
				status,
				dispatchComplete: true,
				blockedReason: status === "blocked" ? "fixture_blocked" : null,
				input: {
					kind: "tagging",
					force: false,
					missingOnly: false,
					thumbnailSize: 512,
				},
			})
			.returning();
		created.push(run.id);
		await db.insert(batchItems).values(
			statuses.map((status) => ({
				runId: run.id,
				kind: "tagging" as const,
				mediaId: randomUUID(),
				mediaSourceId: randomUUID(),
				status,
				...(status === "scheduled"
					? { requestId: randomUUID(), requestedRevision: "fixture-v1" }
					: {}),
			})),
		);
		return run;
	}
	it("retries more than 200 children once per parent, including active failed siblings and stranded pending items", async () => {
		const one = await batch([
			...Array.from({ length: 501 }, () => "failed" as const),
			"completed",
			"cancelled",
			"pending",
		]);
		const two = await batch(
			["failed", "scheduled", "completed"],
			"in_progress",
		);
		const before = await db
			.select()
			.from(batchItems)
			.where(eq(batchItems.runId, one.id));
		expect(await client.retryFailed({})).toMatchObject({
			retried: 2,
			skipped: 0,
			failed: 0,
			cursor: null,
		});
		const after = await db
			.select()
			.from(batchItems)
			.where(eq(batchItems.runId, one.id));
		expect(after.filter((item) => item.status === "pending")).toHaveLength(502);
		for (const item of before.filter((item) =>
			["completed", "cancelled"].includes(item.status),
		))
			expect(after.find((row) => row.id === item.id)).toEqual(item);
		expect(
			(await db.select().from(batchItems).where(eq(batchItems.runId, two.id)))
				.map((item) => item.status)
				.sort(),
		).toEqual(["completed", "pending", "scheduled"]);
		expect(await db.select().from(jobs)).toHaveLength(0);
	});
	it("continues across shrinking pages without retrying a parent twice or reviving blocked/cancelled/new work", async () => {
		for (let index = 0; index < 12; index++) await batch(["failed"]);
		const cancelled = await batch(["cancelled"], "cancelled");
		const blocked = await batch(["blocked"], "blocked");
		let page = await client.retryFailed({});
		expect(page.retried).toBe(5);
		if (!page.cursor) throw new Error("Missing continuation");
		const newer = await batch(["failed"]);
		await db
			.update(batchRuns)
			.set({
				createdAt: new Date(
					new Date(page.cursor.before + "Z").getTime() + 60_000,
				),
			})
			.where(eq(batchRuns.id, newer.id));
		let count = page.retried;
		while (page.cursor) {
			page = await client.retryFailed({ cursor: page.cursor });
			expect(page.retried).toBeLessThanOrEqual(5);
			count += page.retried;
		}
		expect(count).toBe(12);
		for (const [id, status] of [
			[cancelled.id, "cancelled"],
			[blocked.id, "blocked"],
			[newer.id, "failed"],
		])
			expect(
				(await db.select().from(batchRuns).where(eq(batchRuns.id, id)))[0]
					.status,
			).toBe(status);
	});
	it("continues past per-run failures and reports changed records separately", async () => {
		const changed = await batch(["failed"]);
		const broken = await batch(["failed"]);
		for (let index = 0; index < 5; index++) await batch(["failed"]);
		const original = batchRunService.retry.bind(batchRunService);
		vi.spyOn(batchRunService, "retry").mockImplementation(async (id, scope) => {
			if (id === changed.id) throw new ResourceConflictError("Already changed");
			if (id === broken.id) throw new Error("isolated retry failure");
			return original(id, scope);
		});
		let cursor: JobRetryFailedRequest["cursor"];
		const totals = { retried: 0, skipped: 0, failed: 0 };
		do {
			const page = await client.retryFailed({ cursor });
			totals.retried += page.retried;
			totals.skipped += page.skipped;
			totals.failed += page.failed;
			cursor = page.cursor ?? undefined;
		} while (cursor);
		expect(totals).toEqual({ retried: 5, skipped: 1, failed: 1 });
	});
	it("also retries failed downloads and source runs while preserving expired source inputs", async () => {
		const source = await services.getSourceRepository().create({
			name: "Retry all fixture",
			description: null,
			type: "local",
			connectionInfo: { path: "/retry-all-fixture" },
		});
		sources.push(source.id);
		const download = await createRouterClient(downloadsRouter).start({
			mediaSourceId: source.id,
			items: [{ targetUrl: `https://example.invalid/${randomUUID()}.png` }],
		});
		await db
			.update(downloadRuns)
			.set({ status: "failed" })
			.where(eq(downloadRuns.id, download.runIds[0]));
		const input = {
			kind: "export" as const,
			mode: "ndjson" as const,
			includeImages: false,
			sourceRevision: "fixture",
		};
		const transfer = await SourceRunRepository.createTransfer(source.id, input);
		const expired = await SourceRunRepository.createTransfer(source.id, input);
		await db
			.update(sourceTransferRuns)
			.set({ status: "failed" })
			.where(inArray(sourceTransferRuns.id, [transfer.id, expired.id]));
		await db
			.update(sourceTransferRuns)
			.set({ retentionExpiresAt: new Date(0) })
			.where(eq(sourceTransferRuns.id, expired.id));
		expect(await client.retryFailed({})).toEqual({
			retried: 2,
			skipped: 0,
			failed: 0,
			cursor: null,
		});
		expect(
			(
				await db
					.select()
					.from(downloadRuns)
					.where(eq(downloadRuns.id, download.runIds[0]))
			)[0].status,
		).toBe("pending");
		expect((await SourceRunRepository.findById(transfer.id))?.status).toBe(
			"pending",
		);
		expect((await SourceRunRepository.findById(expired.id))?.status).toBe(
			"failed",
		);
	});
});
