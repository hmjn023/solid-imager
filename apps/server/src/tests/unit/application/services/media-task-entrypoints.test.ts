import { MediaQueryService } from "@solid-imager/application/services/media-query-service";
import { beforeEach, describe, expect, it, vi } from "vitest";
const { processTask } = vi.hoisted(() => ({ processTask: vi.fn() }));
vi.mock("~/infrastructure/service-registry", () => ({
	services: { getMediaProcessingService: () => ({ processTask }) },
}));
import {
	generateThumbnailForMedia,
	processThumbnailGenerationJob,
} from "~/infrastructure/jobs/thumbnails";
const sourceId = "11111111-1111-4111-8111-111111111111";
const mediaId = "22222222-2222-4222-8222-222222222222";
describe("shared processing entry points", () => {
	beforeEach(() => {
		processTask.mockReset().mockResolvedValue(undefined);
	});
	it("passes thumbnail job ownership and an explicit rebuild request to the shared runner", async () => {
		const job = {
			id: "33333333-3333-4333-8333-333333333333",
			attemptCount: 2,
			mediaSourceId: sourceId,
			payload: { mediaId, size: 512, force: true },
			parentId: null,
		};
		await processThumbnailGenerationJob(job as any);
		expect(processTask).toHaveBeenCalledWith(
			sourceId,
			mediaId,
			"thumbnail",
			{ jobId: job.id, attemptCount: 2 },
			true,
		);
	});
	it("shares on-demand thumbnail processing without forcing a rebuild", async () => {
		await generateThumbnailForMedia(sourceId, mediaId, 256);
		expect(processTask).toHaveBeenCalledWith(
			sourceId,
			mediaId,
			"thumbnail",
			undefined,
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
			undefined,
			false,
		);
		await query.reprocessMetadata(sourceId, mediaId);
		expect(processTask).toHaveBeenLastCalledWith(
			sourceId,
			mediaId,
			"metadata",
			undefined,
			true,
		);
		processTask.mockRejectedValueOnce(new Error("unreadable"));
		await expect(query.reprocessMetadata(sourceId, mediaId)).rejects.toThrow(
			"unreadable",
		);
	});
});
