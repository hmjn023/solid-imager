import { safeJobSchema } from "@solid-imager/core/domain/jobs/schemas";
import type { Job } from "@solid-imager/core/domain/repositories/job-repository";
import { describe, expect, it } from "vite-plus/test";
import { toSafeJob } from "~/infrastructure/api/routers/jobs-router";

describe("toSafeJob", () => {
	it("returns DB-authoritative parent progress without exposing raw job fields", () => {
		const job: Job = {
			id: "11111111-1111-4111-8111-111111111111",
			type: "bulk_tagging_parent",
			mediaSourceId: "22222222-2222-4222-8222-222222222222",
			status: "failed",
			payload: {
				total: 12,
				processed: 9,
				failed: 3,
				mediaSourceId: "22222222-2222-4222-8222-222222222222",
				secretPath: "/private/media",
			},
			result: { internal: "do not expose" },
			error: "stack trace with /private/media",
			createdAt: new Date("2026-07-23T00:00:00.000Z"),
			updatedAt: new Date("2026-07-23T00:01:00.000Z"),
			parentId: null,
			queueName: "default",
			targetId: null,
			inputRevision: null,
			dedupeKey: "private-dedupe-key",
			concurrencyKey: "private-concurrency-key",
			availableAt: new Date("2026-07-23T00:00:00.000Z"),
			attemptCount: 2,
			maxAttempts: 5,
			leaseDurationMs: 300_000,
			claimToken: null,
			claimedBy: null,
			claimedAt: null,
			heartbeatAt: null,
			errorCode: "JOB_EXECUTION_FAILED",
		};

		const safeJob = toSafeJob(job);

		expect(safeJobSchema.parse(safeJob)).toEqual(safeJob);
		expect(safeJob.progress).toEqual({ processed: 9, failed: 3, total: 12 });
		expect(safeJob.errorMessage).toBe("The job failed.");
		expect(safeJob).not.toHaveProperty("payload");
		expect(safeJob).not.toHaveProperty("result");
		expect(safeJob).not.toHaveProperty("error");
		expect(safeJob).not.toHaveProperty("dedupeKey");
		expect(safeJob).not.toHaveProperty("concurrencyKey");
	});
});
