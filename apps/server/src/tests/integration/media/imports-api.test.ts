import { SourceRunRepository } from "~/infrastructure/repositories/source-run-repository";
import { sourceTransferRuns } from "~/infrastructure/db/schema";
import { randomUUID } from "node:crypto";
import { createRouterClient } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { importsRouter } from "~/infrastructure/api/routers/imports-router";
import { services } from "~/infrastructure/service-registry";
import { db } from "~/infrastructure/db";
import {
	importRequestCutovers,
	importRequests,
	jobs,
	downloadRuns,
	mediaSources,
} from "~/infrastructure/db/schema";

describe("Imports API uses dedicated requests and the existing download reservation", () => {
	const client = createRouterClient(importsRouter);
	const requestIds: string[] = [];
	let sourceId: string;
	const input = () => ({
		targetUrl: `https://example.invalid/${randomUUID()}.png`,
		sourceUrls: [`https://example.invalid/posts/${randomUUID()}`],
		cookies: [{ name: "auth", value: "server-only-secret" }],
		userAgent: "server-only-agent",
	});
	beforeAll(async () => {
		await services.getJobWorker().stop();
		sourceId = (
			await services.getSourceRepository().create({
				name: "Imports API test",
				description: null,
				type: "local",
				connectionInfo: { path: "/isolated-imports-api" },
			})
		).id;
	});
	afterAll(async () => {
		await db.execute(
			sql`DROP TRIGGER IF EXISTS fail_test_import_approval ON import_requests`,
		);
		await db.execute(sql`DROP FUNCTION IF EXISTS fail_test_import_approval()`);
		if (requestIds.length)
			await db
				.delete(importRequests)
				.where(inArray(importRequests.id, requestIds));
		await db.delete(jobs).where(eq(jobs.mediaSourceId, sourceId));
		await db
			.delete(downloadRuns)
			.where(eq(downloadRuns.mediaSourceId, sourceId));
		await db
			.delete(sourceTransferRuns)
			.where(eq(sourceTransferRuns.sourceId, sourceId));
		await db.delete(mediaSources).where(eq(mediaSources.id, sourceId));
		// The suite owns its PGlite database; permit unrelated legacy job fixtures afterward.
		await db
			.update(importRequestCutovers)
			.set({ authority: "legacy", generation: 0 });
	});
	async function receive() {
		const item = input();
		expect(await client.bulkAdd({ items: [item, item] })).toEqual({
			addedCount: 1,
			skippedCount: 1,
			restoredCount: 0,
		});
		const request = (await client.listPending()).find(
			(row) => row.item.targetUrl === item.targetUrl,
		);
		if (!request) throw new Error("Request missing from dedicated inbox");
		requestIds.push(request.id);
		return { item, request };
	}
	it("reserves one download through the real adapter, retaining private input only on the server", async () => {
		const { item, request } = await receive();
		expect(JSON.stringify(request)).not.toMatch(
			/cookies|userAgent|server-only/,
		);
		expect(
			await db.select().from(jobs).where(eq(jobs.id, request.id)),
		).toHaveLength(0);
		expect(
			await client.process({
				jobIds: [request.id, request.id],
				targetSourceId: sourceId,
			}),
		).toEqual({ success: true, processedCount: 1 });
		expect(
			await client.process({ jobIds: [request.id], targetSourceId: sourceId }),
		).toEqual({ success: true, processedCount: 0 });
		const reserved = await db
			.select()
			.from(downloadRuns)
			.where(eq(downloadRuns.mediaSourceId, sourceId));
		expect(reserved).toHaveLength(1);
		expect(reserved[0]).toMatchObject({
			status: "pending",
			input: { ...item, importRequestId: request.id },
		});
		expect(
			(await client.listPending()).some((row) => row.id === request.id),
		).toBe(false);
	});
	it("rolls back the real download insert when saving approval fails", async () => {
		const { request } = await receive();
		await db.execute(
			sql`CREATE FUNCTION fail_test_import_approval() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status = 'approved' THEN RAISE EXCEPTION 'isolated approval failure'; END IF; RETURN NEW; END $$`,
		);
		await db.execute(
			sql`CREATE TRIGGER fail_test_import_approval BEFORE UPDATE ON import_requests FOR EACH ROW EXECUTE FUNCTION fail_test_import_approval()`,
		);
		const before = await db
			.select()
			.from(downloadRuns)
			.where(eq(downloadRuns.mediaSourceId, sourceId));
		try {
			await expect(
				client.process({ jobIds: [request.id], targetSourceId: sourceId }),
			).rejects.toMatchObject({
				code: "INTERNAL_SERVER_ERROR",
				message: "Unable to access import requests",
			});
			expect(
				await db
					.select()
					.from(downloadRuns)
					.where(eq(downloadRuns.mediaSourceId, sourceId)),
			).toEqual(before);
			expect(
				(await client.listPending()).some((row) => row.id === request.id),
			).toBe(true);
		} finally {
			await db.execute(
				sql`DROP TRIGGER fail_test_import_approval ON import_requests`,
			);
			await db.execute(sql`DROP FUNCTION fail_test_import_approval()`);
			await client.cancel({ jobIds: [request.id] });
		}
	});
	it("cancels only pending request IDs and does not cancel executable jobs", async () => {
		const approved = await receive();
		await client.process({
			jobIds: [approved.request.id],
			targetSourceId: sourceId,
		});
		const { request } = await receive();
		const download = await SourceRunRepository.createTransfer(sourceId, {
			kind: "export",
			mode: "ndjson",
			includeImages: false,
			sourceRevision: "fixture",
		});
		await client.cancel({
			jobIds: [request.id, download.id, approved.request.id],
		});
		expect(await SourceRunRepository.findById(download.id)).toEqual(download);
		expect(
			(
				await db
					.select()
					.from(importRequests)
					.where(eq(importRequests.id, request.id))
			)[0].status,
		).toBe("cancelled");
		expect(
			(
				await db
					.select()
					.from(importRequests)
					.where(eq(importRequests.id, approved.request.id))
			)[0].status,
		).toBe("approved");
	});
	it("rejects a missing target without consuming the request or leaking its authentication", async () => {
		const { request } = await receive();
		await expect(
			client.process({ jobIds: [request.id], targetSourceId: randomUUID() }),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Import target not found",
		});
		expect(
			(await client.listPending()).some((row) => row.id === request.id),
		).toBe(true);
		await client.cancel({ jobIds: [request.id] });
	});
});
