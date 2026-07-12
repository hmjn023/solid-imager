import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job as DbJob } from "~/infrastructure/db/schema";

const processBatchCcipDispatchJob = vi.fn();
const processBulkTaggingDispatchJob = vi.fn();

vi.doMock("~/infrastructure/jobs/ccip-jobs", () => ({
	processBatchCcipDispatchJob,
}));

vi.doMock("~/infrastructure/jobs/tagging-jobs", () => ({
	processBulkTaggingDispatchJob,
	processAutoTaggingJob: vi.fn(),
}));

const { processJob } = await import(
	"~/application/services/job-dispatch-service"
);

function createJob(
	type: DbJob["type"],
	mediaSourceId: string | null,
	parentId: string | null = null,
): DbJob {
	return {
		id: "11111111-1111-4111-8111-111111111111",
		type,
		mediaSourceId,
		status: "pending",
		payload: {},
		result: null,
		error: null,
		parentId,
		createdAt: new Date("2026-06-23T00:00:00.000Z"),
		updatedAt: new Date("2026-06-23T00:00:00.000Z"),
	};
}

describe("processJob", () => {
	beforeEach(() => {
		processBatchCcipDispatchJob.mockReset();
		processBulkTaggingDispatchJob.mockReset();
	});

	it("allows batch_ccip_dispatch without mediaSourceId", async () => {
		const job = createJob("batch_ccip_dispatch", null);
		processBatchCcipDispatchJob.mockResolvedValueOnce(undefined);

		await expect(processJob(job)).resolves.toBeUndefined();
		expect(processBatchCcipDispatchJob).toHaveBeenCalledWith(job);
	});

	it("allows bulk_tagging_dispatch without mediaSourceId", async () => {
		const job = createJob("bulk_tagging_dispatch", null);
		processBulkTaggingDispatchJob.mockResolvedValueOnce(undefined);

		await expect(processJob(job)).resolves.toBeUndefined();
		expect(processBulkTaggingDispatchJob).toHaveBeenCalledWith(job);
	});

	it("rejects other job types without mediaSourceId", async () => {
		const job = createJob("processMedia", null);

		await expect(processJob(job)).rejects.toThrow("missing mediaSourceId");
		expect(processBatchCcipDispatchJob).not.toHaveBeenCalled();
		expect(processBulkTaggingDispatchJob).not.toHaveBeenCalled();
	});
});
