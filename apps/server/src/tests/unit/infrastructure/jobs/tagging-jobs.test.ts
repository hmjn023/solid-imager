import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IJobRepository } from "@solid-imager/core/jobs";
import {
	processAutoTaggingJob,
	processBulkTaggingDispatchJob,
} from "~/infrastructure/jobs/tagging-jobs";

const createIfUnique = vi.fn();
const incrementProgress = vi.fn();
const incrementFailedCount = vi.fn();
const findById = vi.fn();
const update = vi.fn();
const publishJob = vi.fn();
const getTagsForMedia = vi.fn();

const jobRepository: IJobRepository = {
	create: vi.fn(),
	createBatch: vi.fn(),
	finishAttempt: vi.fn().mockResolvedValue("completed"),
	finishBatch: vi.fn().mockResolvedValue("completed"),
	createIfUnique: (...args: Parameters<typeof createIfUnique>) =>
		createIfUnique(...args),
	findById: (...args: Parameters<typeof findById>) => findById(...args),
	findPending: vi.fn(),
	markAsInProgress: vi.fn(),
	markAsCompleted: vi.fn(),
	markAsFailed: vi.fn(),
	requestCancellation: vi.fn(),
	markAsCancelled: vi.fn(),
	isCancellationRequested: vi.fn(),
	setArtifact: vi.fn(),
	update: (...args: Parameters<typeof update>) => update(...args),
	incrementProgress: (...args: Parameters<typeof incrementProgress>) =>
		incrementProgress(...args),
	setBatchTotal: vi.fn(),
	recordBatchChildOutcome: vi.fn(),
	incrementFailedCount: (...args: Parameters<typeof incrementFailedCount>) =>
		incrementFailedCount(...args),
	claimPending: vi.fn(),
	requeueStaleInProgress: vi.fn(),
};

vi.mock("~/infrastructure/service-registry", () => ({
	services: {
		getJobRepository: () => jobRepository,
	},
}));

vi.mock("~/infrastructure/services/tagging-service", () => ({
	taggingService: {
		getTagsForMedia: (...args: Parameters<typeof getTagsForMedia>) =>
			getTagsForMedia(...args),
	},
}));

vi.mock("~/infrastructure/db", () => ({
	db: {},
}));

vi.mock("~/infrastructure/events/realtime-event-bus", () => ({
	RealtimeEventBus: {
		publishJob: (...args: Parameters<typeof publishJob>) => publishJob(...args),
	},
}));

vi.mock("~/infrastructure/logger", () => ({
	logger: {
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
	},
}));

describe("processAutoTaggingJob", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getTagsForMedia.mockResolvedValue({
			general: {},
			character: {},
			attributes: {},
			ips: [],
			ips_mapping: {},
		});
		createIfUnique.mockResolvedValue(null);
		vi.mocked(jobRepository.recordBatchChildOutcome).mockResolvedValue(null);
		vi.mocked(jobRepository.recordBatchChildOutcome).mockResolvedValue(null);
	});

	it("does not re-publish parent progress when the child was already counted", async () => {
		await processAutoTaggingJob({
			id: "00000000-0000-4000-8000-000000000020",
			type: "auto_tagging",
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

		expect(jobRepository.recordBatchChildOutcome).toHaveBeenCalledWith(
			"00000000-0000-4000-8000-000000000010",
			"00000000-0000-4000-8000-000000000020",
			0,
			1,
			0,
		);
		expect(findById).not.toHaveBeenCalled();
		expect(createIfUnique).not.toHaveBeenCalled();
		expect(publishJob).not.toHaveBeenCalled();
	});

	it("publishes parent progress and completes the parent once", async () => {
		vi.mocked(jobRepository.recordBatchChildOutcome).mockResolvedValue({
			processed: 1,
			failed: 0,
			total: 1,
		});

		await processAutoTaggingJob({
			id: "00000000-0000-4000-8000-000000000020",
			type: "auto_tagging",
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

		expect(jobRepository.recordBatchChildOutcome).toHaveBeenCalledWith(
			"00000000-0000-4000-8000-000000000010",
			"00000000-0000-4000-8000-000000000020",
			0,
			1,
			0,
		);
		expect(publishJob).toHaveBeenCalledWith("job-progress", {
			jobId: "00000000-0000-4000-8000-000000000010",
			processed: 1,
			total: 1,
		});
		expect(jobRepository.finishBatch).toHaveBeenCalledWith(
			"00000000-0000-4000-8000-000000000010",
		);
		expect(publishJob).toHaveBeenCalledWith("job-completed", {
			jobId: "00000000-0000-4000-8000-000000000010",
			message: "Batch completed",
		});
		expect(createIfUnique).not.toHaveBeenCalled();
	});

	it("increments failed count and marks parent failed when all children are done", async () => {
		vi.mocked(jobRepository.finishBatch).mockResolvedValueOnce("failed");
		getTagsForMedia.mockRejectedValue(new Error("tagging error"));
		vi.mocked(jobRepository.recordBatchChildOutcome).mockResolvedValue({
			processed: 0,
			failed: 1,
			total: 1,
		});

		await expect(
			processAutoTaggingJob({
				id: "00000000-0000-4000-8000-000000000020",
				type: "auto_tagging",
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
		).rejects.toThrow("tagging error");

		expect(jobRepository.recordBatchChildOutcome).toHaveBeenCalledWith(
			"00000000-0000-4000-8000-000000000010",
			"00000000-0000-4000-8000-000000000020",
			0,
			0,
			1,
		);
		expect(jobRepository.finishBatch).toHaveBeenCalledWith(
			"00000000-0000-4000-8000-000000000010",
		);
		expect(publishJob).toHaveBeenCalledWith("job-failed", {
			jobId: "00000000-0000-4000-8000-000000000010",
			error: "1 batch item(s) failed",
		});
	});
});

describe("processBulkTaggingDispatchJob", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("throws when parentId is missing", async () => {
		await expect(
			processBulkTaggingDispatchJob({
				id: "00000000-0000-4000-8000-000000000100",
				type: "bulk_tagging_dispatch",
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
		).rejects.toThrow("bulk_tagging_dispatch requires parentId");
	});
});
