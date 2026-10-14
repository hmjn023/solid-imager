import { randomUUID } from "node:crypto";
import { createRouterClient } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { jobsRouter } from "~/infrastructure/api/routers/jobs-router";
import { services } from "~/infrastructure/service-registry";
import { db } from "~/infrastructure/db";
import { jobs, batchRuns, batchItems } from "~/infrastructure/db/schema";
import { batchParentJobTypes } from "@solid-imager/core/domain/jobs/schemas";
import { batchRunService } from "~/infrastructure/services/batch-run-service";
import { BatchRunRepository } from "~/infrastructure/repositories/batch-run-repository";
import { getImportRequestService } from "~/infrastructure/services/import-request-service";
import { importRequests } from "~/infrastructure/db/schema";
describe("dedicated batch retry through the Jobs facade", () => {
	const created: string[] = [];
	const client = createRouterClient(jobsRouter);
	beforeAll(async () => {
		await services.getJobWorker().stop();
		await batchRunService.initialize();
	});
	afterAll(async () => {
		if (created.length)
			await db.delete(batchRuns).where(inArray(batchRuns.id, created));
	});
	it.each([...batchParentJobTypes, "bulk_tagging_dispatch"])(
		"rejects a retired generic %s producer",
		async (type) => {
			await expect(
				db.insert(jobs).values({ type, status: "failed", payload: {} }),
			).rejects.toThrow();
		},
	);
	it("keeps import approval records non-executable", async () => {
		const imports = getImportRequestService();
		const url = `https://example.invalid/${randomUUID()}.png`;
		await imports.add([{ targetUrl: url }]);
		const record = (await imports.listPending()).find(
			(request) => request.item.targetUrl === url,
		);
		if (!record) throw new Error("Missing import request");
		try {
			await expect(client.retry({ id: record.id })).rejects.toMatchObject({
				code: "NOT_FOUND",
			});
		} finally {
			await db.delete(importRequests).where(eq(importRequests.id, record.id));
		}
	});
	async function fixture(status: "failed" | "pending") {
		const [run] = await db
			.insert(batchRuns)
			.values({
				status,
				input: {
					kind: "tagging",
					force: false,
					missingOnly: false,
					thumbnailSize: 512,
				},
				dispatchComplete: status === "failed",
			})
			.returning();
		created.push(run.id);
		await db.insert(batchItems).values([
			{
				runId: run.id,
				kind: "tagging",
				mediaId: randomUUID(),
				mediaSourceId: randomUUID(),
				status: "completed",
			},
			{
				runId: run.id,
				kind: "tagging",
				mediaId: randomUUID(),
				mediaSourceId: randomUUID(),
				status: status === "failed" ? "failed" : "pending",
			},
		]);
		return run;
	}
	it("resumes only failed items while retaining successful siblings", async () => {
		const run = await fixture("failed");
		const dto = await client.retry({ id: run.id });
		expect(dto).toMatchObject({
			id: run.id,
			status: "pending",
			canRetry: false,
			progress: { total: 2, processed: 1, failed: 0 },
		});
		expect(
			(await BatchRunRepository.listItems(run.id, 100, 0)).items
				.map((item) => item.status)
				.sort(),
		).toEqual(["completed", "pending"]);
	});
	it("cancels and resumes a batch through stable parent IDs", async () => {
		const run = await fixture("pending");
		expect(await client.cancel({ id: run.id })).toMatchObject({
			id: run.id,
			status: "cancelled",
			canRetry: true,
		});
		expect(await client.retry({ id: run.id })).toMatchObject({
			id: run.id,
			status: "pending",
			progress: { total: 2, processed: 1, failed: 0 },
		});
	});
});
