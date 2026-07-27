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
	createParentWithDispatch: vi.fn(),
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
	heartbeatClaim: vi.fn(),
	completeClaim: vi.fn(),
	failClaim: vi.fn(),
	releaseClaim: vi.fn(),
	recomputeBatchProgress: vi.fn(),
	requeueExpiredLeases: vi.fn(),
	requeueStaleInProgress: vi.fn(),
};

vi.mock("~/application/registry", () => ({
	services: { getJobRepository: () => jobRepository },
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

vi.mock("~/infrastructure/db", () => ({ db: {} }));

const childJob = {
	id: "00000000-0000-4000-8000-000000000020",
	type: "extract_ccip_vector",
	mediaSourceId: "00000000-0000-4000-8000-000000000001",
	status: "in_progress" as const,
	payload: {
		mediaId: "00000000-0000-4000-8000-000000000030",
		force: false,
	},
	result: null,
	error: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	parentId: "00000000-0000-4000-8000-000000000010",
};

describe("processCcipExtractionJob", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		extract.mockResolvedValue({
			record: { mediaId: childJob.payload.mediaId },
			skipped: false,
		});
	});

	it("delegates child completion and parent accounting to the worker", async () => {
		const result = await processCcipExtractionJob(childJob);

		expect(result).toEqual({
			record: { mediaId: childJob.payload.mediaId },
			skipped: false,
		});
		expect(extract).toHaveBeenCalledWith(
			childJob.mediaSourceId,
			childJob.payload.mediaId,
			false,
			undefined,
		);
		expect(incrementProgress).not.toHaveBeenCalled();
		expect(incrementFailedCount).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
		expect(publishJob).not.toHaveBeenCalled();
	});

	it("propagates the worker abort signal into extraction", async () => {
		const controller = new AbortController();
		await processCcipExtractionJob(childJob, controller.signal);

		expect(extract).toHaveBeenCalledWith(
			childJob.mediaSourceId,
			childJob.payload.mediaId,
			false,
			controller.signal,
		);
	});

	it("rethrows failures without mutating parent progress from the child handler", async () => {
		extract.mockRejectedValue(new Error("ccip error"));

		await expect(processCcipExtractionJob(childJob)).rejects.toThrow("ccip error");
		expect(incrementFailedCount).not.toHaveBeenCalled();
		expect(incrementProgress).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
		expect(publishJob).not.toHaveBeenCalled();
	});

	it("supports legacy mediaIds payloads without child-owned progress", async () => {
		const mediaIds = [
			"00000000-0000-4000-8000-000000000031",
			"00000000-0000-4000-8000-000000000032",
		];
		extractBatch.mockResolvedValue(
			mediaIds.map((mediaId) => ({
				status: "fulfilled",
				value: { mediaId, record: { mediaId }, skipped: false },
			})),
		);

		await processCcipExtractionJob({
			...childJob,
			id: "00000000-0000-4000-8000-000000000022",
			payload: { mediaIds, force: false },
		});

		expect(extractBatch).toHaveBeenCalledWith(
			childJob.mediaSourceId,
			mediaIds,
			false,
			1,
			undefined,
		);
		expect(incrementProgress).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
		expect(publishJob).not.toHaveBeenCalled();
	});
});

describe("processBatchCcipDispatchJob", () => {
	it("throws when parentId is missing", async () => {
		await expect(
			processBatchCcipDispatchJob({
				...childJob,
				type: "batch_ccip_dispatch",
				payload: { mediaSourceId: childJob.mediaSourceId, force: false },
				parentId: null,
			}),
		).rejects.toThrow("batch_ccip_dispatch requires parentId");
	});
});
