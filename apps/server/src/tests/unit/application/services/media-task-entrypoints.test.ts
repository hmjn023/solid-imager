import { MediaQueryService } from "@solid-imager/application/services/media-query-service";
import { beforeEach, describe, expect, it, vi } from "vitest";
const { processTask, requestTask, waitForTask, withActiveAttempt, updateJob } =
	vi.hoisted(() => ({
		processTask: vi.fn(),
		requestTask: vi.fn(),
		waitForTask: vi.fn(),
		withActiveAttempt: vi.fn(),
		updateJob: vi.fn(),
	}));
vi.mock("~/infrastructure/service-registry", () => ({
	services: {
		getMediaProcessingService: () => ({
			processTask,
			requestTask,
			waitForTask,
		}),
		getJobRepository: () => ({ withActiveAttempt, update: updateJob }),
	},
}));
import { generateThumbnailForMedia } from "~/infrastructure/jobs/thumbnails";
const sourceId = "11111111-1111-4111-8111-111111111111";
const mediaId = "22222222-2222-4222-8222-222222222222";
const request = {
	requestId: "44444444-4444-4444-8444-444444444444",
	requestedRevision: "revision",
};
const transaction = {};
describe("shared processing entry points", () => {
	beforeEach(() => {
		processTask.mockReset().mockResolvedValue(undefined);
		requestTask.mockReset().mockResolvedValue(request);
		waitForTask.mockReset().mockResolvedValue(undefined);
		updateJob.mockReset().mockResolvedValue(undefined);
		withActiveAttempt
			.mockReset()
			.mockImplementation((_id, _attempt, action) => action(transaction));
	});
	it("shares on-demand thumbnail processing without forcing a rebuild", async () => {
		await generateThumbnailForMedia(sourceId, mediaId, 256);
		expect(processTask).toHaveBeenCalledWith(
			sourceId,
			mediaId,
			"thumbnail",
			false,
		);
	});
	it("uses the same metadata runner for detail fallback and explicit reprocessing, surfacing reprocess failures", async () => {
		const media = {
			id: mediaId,
			mediaSourceId: sourceId,
			generationInfo: null,
		};
		const repository = {
			findById: vi.fn().mockResolvedValue(media),
			getDetails: vi.fn().mockResolvedValue(media),
			getGenerationInfo: vi.fn().mockResolvedValue(null),
		};
		const sourceRepository = {
			findById: vi.fn().mockResolvedValue({ type: "local" }),
		};
		const query = new MediaQueryService(
			repository as any,
			sourceRepository as any,
			{} as any,
			{ processTask },
			{ info: vi.fn(), warn: vi.fn(), error: vi.fn() },
		);
		await query.getMediaDetails(sourceId, mediaId);
		expect(processTask).toHaveBeenLastCalledWith(
			sourceId,
			mediaId,
			"metadata",
			false,
		);
		await query.reprocessMetadata(sourceId, mediaId);
		expect(processTask).toHaveBeenLastCalledWith(
			sourceId,
			mediaId,
			"metadata",
			true,
		);
		processTask.mockRejectedValueOnce(new Error("unreadable"));
		await expect(query.reprocessMetadata(sourceId, mediaId)).rejects.toThrow(
			"unreadable",
		);
	});
});
