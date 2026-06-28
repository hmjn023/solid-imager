import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import { processCcipExtractionJob } from "~/infrastructure/jobs/ccip-jobs";

const publishJob = vi.fn();
const extract = vi.fn();
const loggerError = vi.fn();

const jobRepository: IJobRepository = {
	create: vi.fn(),
	createIfUnique: vi.fn(),
	findById: vi.fn(),
	findPending: vi.fn(),
	markAsInProgress: vi.fn(),
	markAsCompleted: vi.fn(),
	markAsFailed: vi.fn(),
	update: vi.fn(),
	incrementProgress: vi.fn(),
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
	},
}));

vi.mock("~/infrastructure/events/realtime-event-bus", () => ({
	RealtimeEventBus: {
		publishJob: (...args: Parameters<typeof publishJob>) => publishJob(...args),
	},
}));

vi.mock("~/infrastructure/logger", () => ({
	logger: {
		error: (...args: Parameters<typeof loggerError>) => loggerError(...args),
	},
}));

describe("processCcipExtractionJob", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("publishes child completion and completes the parent once", async () => {
		extract.mockResolvedValue(undefined);
		vi.mocked(jobRepository.incrementProgress).mockResolvedValue(true);
		vi.mocked(jobRepository.findById).mockResolvedValue({
			id: "00000000-0000-4000-8000-000000000010",
			type: "batch_ccip_parent",
			mediaSourceId: "00000000-0000-4000-8000-000000000001",
			status: "in_progress",
			payload: {
				total: 1,
				processed: 1,
				processedJobIds: ["00000000-0000-4000-8000-000000000020"],
			},
			result: null,
			error: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			parentId: null,
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
		expect(jobRepository.incrementProgress).toHaveBeenCalledWith(
			"00000000-0000-4000-8000-000000000010",
			"00000000-0000-4000-8000-000000000020",
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
		expect(jobRepository.markAsCompleted).toHaveBeenCalledWith(
			"00000000-0000-4000-8000-000000000010",
			{ success: true },
		);
	});

	it("skips parent progress when the child was already counted", async () => {
		extract.mockResolvedValue(undefined);
		vi.mocked(jobRepository.incrementProgress).mockResolvedValue(false);

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
		expect(jobRepository.markAsCompleted).not.toHaveBeenCalled();
	});
});
