import { createRouterClient } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { jobsRouter } from "~/infrastructure/api/routers/jobs-router";
import { services } from "~/infrastructure/service-registry";
import { db } from "~/infrastructure/db";
import { jobs } from "~/infrastructure/db/schema";
import { batchParentJobTypes } from "@solid-imager/core/domain/jobs/schemas";

describe("non-executable jobs cannot be retried through the job API", () => {
	const created: string[] = [];
	const client = createRouterClient(jobsRouter);
	beforeAll(() => services.getJobWorker().stop());
	afterAll(async () => {
		if (created.length) await db.delete(jobs).where(inArray(jobs.id, created));
	});
	it.each([...batchParentJobTypes, "import_request"])(
		"preserves failed %s rather than leaving it pending",
		async (type) => {
			const repo = services.getJobRepository();
			const job = await repo.create({
				type,
				status: "failed",
				error: "Job failed",
			});
			created.push(job.id);
			await expect(client.retry({ id: job.id })).rejects.toMatchObject({
				code: "BAD_REQUEST",
				message:
					"This job is not executable. Retry failed processing steps or dispatch jobs instead.",
			});
			expect(await repo.findById(job.id)).toEqual(job);
		},
	);
	it("still allows a failed executable dispatch job to be retried", async () => {
		const repo = services.getJobRepository();
		const job = await repo.create({
			type: "bulk_tagging_dispatch",
			status: "failed",
			payload: {},
		});
		created.push(job.id);
		expect(await client.retry({ id: job.id })).toMatchObject({
			id: job.id,
			status: "pending",
		});
	});
});
