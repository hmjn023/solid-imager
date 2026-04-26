import { describe, expect, it, vi } from "vite-plus/test";
import type { JobRecord } from "../ports/job-repository";
import {
	createJobEventPublisher,
	runAutoTaggingJob,
	runBulkTaggingDispatchJob,
} from "../services/tagging-job-runner";

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
	const now = new Date();
	return {
		id: "job-1",
		type: "auto_tagging",
		mediaSourceId: "source-1",
		status: "pending",
		payload: { mediaId: "media-1" },
		result: null,
		error: null,
		createdAt: now,
		updatedAt: now,
		parentId: null,
		...overrides,
	};
}

describe("tagging-job-runner", () => {
	it("updates parent progress and emits completion events", async () => {
		const publish = vi.fn(async () => undefined);
		const jobEvents = createJobEventPublisher(publish);
		const findById = vi.fn(async () =>
			makeJob({
				id: "parent",
				type: "bulk_tagging_parent",
				payload: { total: 2, processed: 2 },
				mediaSourceId: "source-1",
			}),
		);
		const update = vi.fn(async () => undefined);

		await runAutoTaggingJob(
			makeJob({
				parentId: "parent",
				payload: { mediaId: "media-1", force: true },
			}),
			{
				jobRepository: {
					incrementProgress: vi.fn(async () => undefined),
					findById,
					update,
				},
				executeAutoTagging: vi.fn(async () => undefined),
				jobEvents,
			},
		);

		expect(findById).toHaveBeenCalledWith("parent");
		expect(update).toHaveBeenCalledWith("parent", { status: "completed" });
		expect(publish).toHaveBeenCalledWith("job-progress", {
			jobId: "parent",
			processed: 2,
			total: 2,
		});
		expect(publish).toHaveBeenCalledWith("job-completed", {
			jobId: "parent",
			message: "Batch tagging completed.",
		});
		expect(publish).toHaveBeenCalledWith("all-jobs-completed", {
			mediaSourceId: "source-1",
			processed: 2,
		});
	});

	it("enqueues auto-tagging child jobs from dispatch results", async () => {
		const create = vi.fn(async () => makeJob());
		await runBulkTaggingDispatchJob(
			makeJob({
				type: "bulk_tagging_dispatch",
				payload: { force: true, mediaSourceId: "source-1" },
			}),
			{
				jobRepository: { create },
				scanTargets: vi.fn(async () => [
					{ id: "media-1", mediaSourceId: "source-1" },
					{ id: "media-2", mediaSourceId: "source-2" },
				]),
			},
		);

		expect(create).toHaveBeenCalledTimes(2);
		expect(create).toHaveBeenCalledWith({
			type: "auto_tagging",
			mediaSourceId: "source-1",
			payload: {
				mediaId: "media-1",
				mediaSourceId: "source-1",
				force: true,
			},
		});
	});
});
