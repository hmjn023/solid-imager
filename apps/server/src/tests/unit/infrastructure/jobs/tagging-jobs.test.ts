import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { IJobRepository } from "~/domain/repositories/job-repository";
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
	createIfUnique: (...args: Parameters<typeof createIfUnique>) =>
		createIfUnique(...args),
	createParentWithDispatch: vi.fn(),
	findById: (...args: Parameters<typeof findById>) => findById(...args),
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
	services: {
		getJobRepository: () => jobRepository,
	},
}));

vi.mock("~/application/services/tagging-service", () => ({
	taggingService: {
		getTagsForMedia: (...args: Parameters<typeof getTagsForMedia>) =>
			getTagsForMedia(...args),
	},
}));

vi.mock("~/infrastructure/db", () => ({ db: {} }));

vi.mock("~/infrastructure/events/realtime-event-bus", () => ({
	RealtimeEventBus: {
		publishJob: (...args: Parameters<typeof publishJob>) => publishJob(...args),
	},
}));

vi.mock("~/infrastructure/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const childJob = {
	id: "00000000-0000-4000-8000-000000000020",
	type: "auto_tagging",
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

describe("processAutoTaggingJob", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getTagsForMedia.mockResolvedValue({
			general: {},
			character: {},
			ips: [],
			ips_mapping: {},
		});
		createIfUnique.mockResolvedValue(null);
	});

	it("delegates parent accounting to the worker after the child is terminal", async () => {
		await processAutoTaggingJob(childJob);

		expect(getTagsForMedia).toHaveBeenCalledWith(
			childJob.mediaSourceId,
			childJob.payload.mediaId,
			{ signal: undefined, skipCache: false },
		);
		expect(createIfUnique).toHaveBeenCalledWith({
			type: "sync_lancedb_delta",
			mediaSourceId: childJob.mediaSourceId,
			payload: {
				reason: "auto_tagging",
				mediaIds: [childJob.payload.mediaId],
			},
		});
		expect(incrementProgress).not.toHaveBeenCalled();
		expect(incrementFailedCount).not.toHaveBeenCalled();
		expect(findById).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
		expect(publishJob).not.toHaveBeenCalled();
	});

	it("propagates the worker abort signal into the AI operation", async () => {
		const controller = new AbortController();
		await processAutoTaggingJob(
			{ ...childJob, payload: { ...childJob.payload, force: true } },
			controller.signal,
		);

		expect(getTagsForMedia).toHaveBeenCalledWith(
			childJob.mediaSourceId,
			childJob.payload.mediaId,
			{ signal: controller.signal, skipCache: true },
		);
	});

	it("rethrows failures without mutating parent progress from the child handler", async () => {
		getTagsForMedia.mockRejectedValue(new Error("tagging error"));

		await expect(processAutoTaggingJob(childJob)).rejects.toThrow("tagging error");
		expect(incrementFailedCount).not.toHaveBeenCalled();
		expect(incrementProgress).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
		expect(publishJob).not.toHaveBeenCalled();
	});
});

describe("processBulkTaggingDispatchJob", () => {
	it("throws when parentId is missing", async () => {
		await expect(
			processBulkTaggingDispatchJob({
				...childJob,
				type: "bulk_tagging_dispatch",
				payload: { mediaSourceId: childJob.mediaSourceId, force: false },
				parentId: null,
			}),
		).rejects.toThrow("bulk_tagging_dispatch requires parentId");
	});
});
