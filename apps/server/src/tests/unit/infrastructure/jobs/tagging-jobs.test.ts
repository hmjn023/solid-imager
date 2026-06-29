import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import { processAutoTaggingJob } from "~/infrastructure/jobs/tagging-jobs";

const createIfUnique = vi.fn();
const incrementProgress = vi.fn();
const findById = vi.fn();
const publishJob = vi.fn();
const getTagsForMedia = vi.fn();

const jobRepository: IJobRepository = {
	create: vi.fn(),
	createIfUnique: (...args: Parameters<typeof createIfUnique>) =>
		createIfUnique(...args),
	findById: (...args: Parameters<typeof findById>) => findById(...args),
	findPending: vi.fn(),
	markAsInProgress: vi.fn(),
	markAsCompleted: vi.fn(),
	markAsFailed: vi.fn(),
	update: vi.fn(),
	incrementProgress: (...args: Parameters<typeof incrementProgress>) =>
		incrementProgress(...args),
	claimPending: vi.fn(),
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
		getTagsForMedia.mockResolvedValue({ general: {}, character: {}, ips: [], ips_mapping: {} });
		createIfUnique.mockResolvedValue(null);
		incrementProgress.mockResolvedValue(false);
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

		expect(incrementProgress).toHaveBeenCalledWith(
			"00000000-0000-4000-8000-000000000010",
			"00000000-0000-4000-8000-000000000020",
		);
		expect(findById).not.toHaveBeenCalled();
		expect(publishJob).not.toHaveBeenCalled();
	});
});
