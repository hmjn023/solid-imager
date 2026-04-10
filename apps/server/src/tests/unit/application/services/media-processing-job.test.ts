import { describe, expect, it, vi } from "vite-plus/test";
import {
	getMediaProcessingSteps,
	hasMediaProcessingStep,
	MEDIA_PROCESSING_STEPS,
	queueMediaProcessingJob,
} from "~/application/services/media-processing-job";

describe("media-processing-job", () => {
	it("uses the default integrated processing steps when none are provided", () => {
		expect(getMediaProcessingSteps(undefined)).toEqual(MEDIA_PROCESSING_STEPS);
		expect(
			hasMediaProcessingStep(
				{
					mediaId: "media-id",
					sourcePath: "/media/source",
				},
				"generateThumbnail",
			),
		).toBe(true);
	});

	it("queues a processMedia job with the standardized payload", async () => {
		const jobRepo = {
			create: vi.fn().mockResolvedValue(undefined),
			createIfUnique: vi.fn(),
			findById: vi.fn(),
			findPending: vi.fn(),
			markAsInProgress: vi.fn(),
			markAsCompleted: vi.fn(),
			markAsFailed: vi.fn(),
			update: vi.fn(),
			updateResult: vi.fn(),
			incrementProgress: vi.fn(),
			incrementProcessedCount: vi.fn(),
		};

		await queueMediaProcessingJob({
			jobRepo,
			mediaId: "media-id",
			mediaSourceId: "source-id",
			sourcePath: "/media/source",
			steps: ["generateThumbnail"],
		});

		expect(jobRepo.create).toHaveBeenCalledWith({
			type: "processMedia",
			mediaSourceId: "source-id",
			payload: {
				mediaId: "media-id",
				sourcePath: "/media/source",
				steps: ["generateThumbnail"],
				type: "processMedia",
			},
		});
	});
});
