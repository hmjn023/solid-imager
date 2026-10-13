import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { downloadsRouter } from "~/infrastructure/api/routers/downloads-router";
import { jobsRouter } from "~/infrastructure/api/routers/jobs-router";
import { DownloadRunRepository } from "~/infrastructure/repositories/download-run-repository";
import { services } from "~/infrastructure/service-registry";
import { db } from "~/infrastructure/db";
import { downloadRuns, jobs, mediaSources } from "~/infrastructure/db/schema";

describe("Downloads API and transitional Jobs view", () => {
	const client = createRouterClient(downloadsRouter);
	const jobClient = createRouterClient(jobsRouter);
	let sourceId: string;
	let directory: string;
	let canonical: string;
	const item = () => ({
		targetUrl: `https://example.invalid/${randomUUID()}.png`,
		cookies: [{ name: "auth", value: "private-download-cookie" }],
		userAgent: "private-download-agent",
	});
	beforeAll(async () => {
		services.getJobWorker().stop();
		directory = await mkdtemp(path.join(tmpdir(), "downloads-api-"));
		sourceId = (
			await services.getSourceRepository().create({
				name: "Downloads API",
				description: null,
				type: "local",
				connectionInfo: { path: directory },
			})
		).id;
	});
	afterAll(async () => {
		await db.delete(downloadRuns).where(eq(downloadRuns.status, "superseded"));
		await db
			.delete(downloadRuns)
			.where(eq(downloadRuns.mediaSourceId, sourceId));
		await db.delete(jobs).where(eq(jobs.mediaSourceId, sourceId));
		await db.delete(mediaSources).where(eq(mediaSources.id, sourceId));
		await rm(directory, { recursive: true, force: true });
	});
	it("returns durable receipt IDs and omits private data from both APIs", async () => {
		const input = item();
		const created = await client.start({
			mediaSourceId: sourceId,
			items: [input, input],
		});
		expect(created).toMatchObject({
			success: true,
			jobCount: 1,
			skippedCount: 1,
		});
		expect(created.runIds).toHaveLength(2);
		canonical = created.runIds[0];
		const pending = await client.get({ id: canonical });
		expect(pending).toMatchObject({
			status: "pending",
			targetUrl: input.targetUrl,
			attemptCount: 0,
		});
		expect((await client.get({ id: created.runIds[1] })).canonicalId).toBe(
			canonical,
		);
		expect(JSON.stringify(pending)).not.toMatch(
			/private-download|cookies|userAgent|leaseToken|sourcePath|checkpoint/,
		);
		const view = await jobClient.get({ id: canonical });
		expect(view).toMatchObject({ type: "downloadImage", status: "pending" });
		expect(JSON.stringify(view)).not.toMatch(
			/private-download|cookies|payload|sourcePath|checkpoint/,
		);
		expect(
			await db.select().from(jobs).where(eq(jobs.mediaSourceId, sourceId)),
		).toHaveLength(0);
	});
	it("paginates and filters the combined view, hiding duplicate aliases", async () => {
		const general = await services.getJobRepository().create({
			type: "source_restore",
			mediaSourceId: sourceId,
			payload: {},
			createdAt: new Date("2026-01-01T00:00:00Z"),
		});
		const first = await jobClient.list({
			limit: 1,
			offset: 0,
			status: "pending",
		});
		const second = await jobClient.list({
			limit: 1,
			offset: 1,
			status: "pending",
		});
		expect(first.total).toBe(2);
		expect(second.total).toBe(2);
		expect(first.items[0].id).toBe(canonical);
		expect(second.items[0].id).toBe(general.id);
		expect(
			await jobClient.list({ limit: 1, offset: 99, status: "pending" }),
		).toEqual({ items: [], total: 2 });
		expect(
			(await client.list({ mediaSourceId: sourceId, limit: 50, offset: 0 }))
				.total,
		).toBe(2);
	});
	it("uses dedicated cancellation through the existing Jobs API", async () => {
		expect(await jobClient.cancel({ id: canonical })).toMatchObject({
			id: canonical,
			status: "cancelled",
		});
		expect(await client.get({ id: canonical })).toMatchObject({
			status: "cancelled",
		});
		await expect(jobClient.retry({ id: canonical })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
	});
	it("retries failed runs through either API without resetting the attempt counter", async () => {
		const result = await client.start({
			mediaSourceId: sourceId,
			items: [item()],
		});
		const [run] = await DownloadRunRepository.claimPending(1);
		expect(run.id).toBe(result.runIds[0]);
		await DownloadRunRepository.settle(
			run,
			"failed",
			"private upstream failure",
		);
		expect(await jobClient.retry({ id: run.id })).toMatchObject({
			id: run.id,
			status: "pending",
			attemptCount: 1,
		});
		await client.cancel({ id: run.id });
	});
	it("preserves unrelated jobs and refuses unknown download IDs", async () => {
		const general = (
			await db.select().from(jobs).where(eq(jobs.mediaSourceId, sourceId))
		)[0];
		await expect(client.cancel({ id: general.id })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		expect(
			(await db.select().from(jobs).where(eq(jobs.id, general.id)))[0],
		).toEqual(general);
		await expect(client.get({ id: randomUUID() })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});
	it("rejects unsupported schemes before reservation without exposing a local path", async () => {
		await expect(
			client.start({
				mediaSourceId: sourceId,
				items: [{ targetUrl: "file:///private/image.png" }],
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: "Invalid download input",
		});
	});
});
