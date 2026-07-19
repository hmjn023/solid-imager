import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import {
	processBatchCcipDispatchJob,
	processCcipExtractionJob,
} from "~/infrastructure/jobs/ccip-jobs";

const publishJob = vi.fn();
const extract = vi.fn();
const extractBatch = vi.fn();
const loggerError = vi.fn();
const update = vi.fn();
const incrementProgress = vi.fn();
const incrementFailedCount = vi.fn();

const jobRepository: IJobRepository = {
	create: vi.fn(),
	createIfUnique: vi.fn(),
	findById: vi.fn(),
	findPending: vi.fn(),
	markAsInProgress: vi.fn(),
	markAsCompleted: vi.fn(),
	markAsFailed: vi.fn(),
	update: (...args: Parameters<typeof update>) => update(...args),
	incrementProgress: (...args: Parameters<typeof incrementProgress>) =>
		incrementProgress(...args),
	incrementFailedCount: (...args: Parameters<typeof incrementFailedCount>) =>
		incrementFailedCount(...args),
	claimPending: vi.fn(),
	requeueStaleInProgress: vi.fn(),
};

vi.mock("~/application/registry", () => ({
	services: {
		getJobRepository: () => jobRepository,
	},
}));

vi.mock("~/application/services/ccip-vector-service", () => ({
	ccipVectorService: {
		extract: (...args: Parameters<typeof extract>) => extract(...args),
		extractBatch: (...args: Parameters<typeof extractBatch>) =>
			extractBatch(...args),
	},
}));

vi.mock("~/infrastructure/events/realtime-event-bus", () => ({
	RealtimeEventBus: {
		publishJob: (...args: Parameters<typeof publishJob>) => publishJob(...args),
	},
}));

vi.mock("~/infrastructure/logger", () => ({
	logger: {
		info: vi.fn(),
		error: (...args: Parameters<typeof loggerError>) => loggerError(...args),
	},
}));

vi.mock("~/infrastructure/db", () => ({
	db: {},
}));

describe("processCcipExtractionJob", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("publishes child completion and completes the parent once", async () => {
		extract.mockResolvedValue({
			record: { mediaId: "00000000-0000-4000-8000-000000000030" },
			skipped: false,
		});
		incrementProgress.mockResolvedValue({
			processed: 1,
			failed: 0,
			total: 1,
		});

		await processCcipExtractionJob({
			id: "00000000-0000-4000-8000-000000000020",
			type: "extract_ccip_vector",
			mediaSourceId: "00000000-0000-4000-8000-000000000001",
			status: "in_progress",
			payload: {
				mediaId: "00000000-0000-4000-8000-000000000030",
				force: false,
			},
			result: null,
			error: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			parentId: "00000000-0000-4000-8000-000000000010",
		});

		expect(extract).toHaveBeenCalled();
		expect(incrementProgress).toHaveBeenCalledWith(
			"00000000-0000-4000-8000-000000000010",
			"00000000-0000-4000-8000-000000000020",
			1,
		);
		expect(publishJob).toHaveBeenCalledWith("job-completed", {
			jobId: "00000000-0000-4000-8000-000000000020",
			message: "CCIP vector extraction completed",
		});
		expect(publishJob).toHaveBeenCalledWith("job-progress", {
			jobId: "00000000-0000-4000-8000-000000000010",
			processed: 1,
			total: 1,
		});
		expect(update).toHaveBeenCalledWith(
			"00000000-0000-4000-8000-000000000010",
			{
				status: "completed",
			},
		);
	});

	it("skips parent progress when the child was already counted", async () => {
		extract.mockResolvedValue({
			record: { mediaId: "00000000-0000-4000-8000-000000000031" },
			skipped: false,
		});
		incrementProgress.mockResolvedValue(null);

		await processCcipExtractionJob({
			id: "00000000-0000-4000-8000-000000000021",
			type: "extract_ccip_vector",
			mediaSourceId: "00000000-0000-4000-8000-000000000001",
			status: "in_progress",
			payload: {
				mediaId: "00000000-0000-4000-8000-000000000031",
				force: false,
			},
			result: null,
			error: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			parentId: "00000000-0000-4000-8000-000000000011",
		});

		expect(jobRepository.findById).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});

	it("increments failed count and marks parent failed when all children are done", async () => {
		extract.mockRejectedValue(new Error("ccip error"));
		incrementFailedCount.mockResolvedValue({
			processed: 0,
			failed: 1,
			total: 1,
		});

		await expect(
			processCcipExtractionJob({
				id: "00000000-0000-4000-8000-000000000020",
				type: "extract_ccip_vector",
				mediaSourceId: "00000000-0000-4000-8000-000000000001",
				status: "in_progress",
				payload: {
					mediaId: "00000000-0000-4000-8000-000000000030",
					force: false,
				},
				result: null,
				error: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				parentId: "00000000-0000-4000-8000-000000000010",
			}),
		).rejects.toThrow("ccip error");

		expect(incrementFailedCount).toHaveBeenCalledWith(
			"00000000-0000-4000-8000-000000000010",
			"00000000-0000-4000-8000-000000000020",
			1,
		);
		expect(update).toHaveBeenCalledWith(
			"00000000-0000-4000-8000-000000000010",
			{
				status: "failed",
			},
		);
		expect(publishJob).toHaveBeenCalledWith("job-failed", {
			jobId: "00000000-0000-4000-8000-000000000010",
			error: "1 item(s) failed",
		});
	});

	it("extracts and persists a CCIP batch with item-based parent progress", async () => {
		const mediaIds = [
			"00000000-0000-4000-8000-000000000031",
			"00000000-0000-4000-8000-000000000032",
		];
		extractBatch.mockResolvedValue(
			mediaIds.map((mediaId) => ({
				status: "fulfilled",
				value: {
					mediaId,
					record: { mediaId },
					skipped: false,
				},
			})),
		);
		incrementProgress.mockResolvedValue({
			processed: 2,
			failed: 0,
			total: 2,
		});

		await processCcipExtractionJob({
			id: "00000000-0000-4000-8000-000000000022",
			type: "extract_ccip_vector",
			mediaSourceId: "00000000-0000-4000-8000-000000000001",
			status: "in_progress",
			payload: { mediaIds, force: false },
			result: null,
			error: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			parentId: "00000000-0000-4000-8000-000000000012",
		});

		expect(extractBatch).toHaveBeenCalledWith(
			"00000000-0000-4000-8000-000000000001",
			mediaIds,
			false,
			1,
		);
		expect(incrementProgress).toHaveBeenCalledWith(
			"00000000-0000-4000-8000-000000000012",
			"00000000-0000-4000-8000-000000000022",
			2,
		);
		expect(update).toHaveBeenCalledWith(
			"00000000-0000-4000-8000-000000000012",
			{
				status: "completed",
			},
		);
	});
});

describe("processBatchCcipDispatchJob", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("throws when parentId is missing", async () => {
		await expect(
			processBatchCcipDispatchJob({
				id: "00000000-0000-4000-8000-000000000100",
				type: "batch_ccip_dispatch",
				mediaSourceId: "00000000-0000-4000-8000-000000000001",
				status: "in_progress",
				payload: {
					mediaSourceId: "00000000-0000-4000-8000-000000000001",
					force: false,
				},
				result: null,
				error: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				parentId: null,
			}),
		).rejects.toThrow("batch_ccip_dispatch requires parentId");
	});
});
