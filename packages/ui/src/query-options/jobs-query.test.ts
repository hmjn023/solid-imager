import type { JobListResponse } from "@solid-imager/core/domain/jobs/schemas";
import { describe, expect, it } from "vitest";
import { updateJobProgress } from "./jobs-query";

const jobList: JobListResponse = {
	items: [
		{
			artifact: null,
			attemptCount: 1,
			cancelRequestedAt: null,
			cancelledAt: null,
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			error: null,
			finishedAt: null,
			id: "00000000-0000-4000-8000-000000000001",
			mediaSourceId: null,
			parentId: null,
			progress: { failed: 2, processed: 1, total: 10 },
			startedAt: new Date("2026-01-01T00:00:01.000Z"),
			status: "in_progress",
			targetMediaId: null,
			targetMediaModifiedAt: null,
			type: "batch_tagging_parent",
			updatedAt: new Date("2026-01-01T00:00:02.000Z"),
		},
	],
	total: 1,
};

describe("updateJobProgress", () => {
	it("updates a matching cached job while preserving failure counts", () => {
		const updated = updateJobProgress(jobList, {
			jobId: "00000000-0000-4000-8000-000000000001",
			processed: 7,
			total: 12,
		});

		expect(updated?.items[0]?.progress).toEqual({
			failed: 2,
			processed: 7,
			total: 12,
		});
	});

	it("does not replace a list that does not contain the event job", () => {
		const updated = updateJobProgress(jobList, {
			jobId: "00000000-0000-4000-8000-000000000002",
			processed: 7,
			total: 12,
		});

		expect(updated).toBe(jobList);
	});
});
