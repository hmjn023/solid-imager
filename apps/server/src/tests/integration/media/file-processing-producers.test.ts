import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "~/infrastructure/db";
import { mediaSources, medias, jobs } from "~/infrastructure/db/schema";
import { MediaProcessingStateRepository } from "~/infrastructure/repositories/media-processing-state-repository";
import { services } from "~/infrastructure/service-registry";
import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import { BackupService } from "~/infrastructure/services/backup-service";
import { FileWatcherService } from "~/infrastructure/jobs/file-watcher-service";
import { FileWatcherManager } from "~/infrastructure/jobs/file-watcher-manager";
import {
	generateThumbnailsForSource,
	getSourceCacheDir,
	getThumbnailPath,
	processThumbnailGenerationJob,
	queueThumbnailGeneration,
} from "~/infrastructure/jobs/thumbnails";

vi.mock("~/infrastructure/jobs/file-watcher-manager", () => ({
	FileWatcherManager: { start: vi.fn(), stop: vi.fn() },
}));

describe("dedicated file processing producers", () => {
	let directory: string;
	let sourceId: string;
	const dump = {
		filePath: "image.png",
		fileName: "image.png",
		mediaType: "image",
		generationInfo: { prompt: "restored prompt", workflow: { restored: true } },
		tags: [{ name: "restored-tag", type: "positive", source: "manual" }],
	};
	beforeEach(async () => {
		vi.restoreAllMocks();
		services.getJobWorker().stop();
		await services.getMediaFileWorker().stop();
		await services.getMediaAiWorker().stop();
		services.getMediaProcessingService().updateConfig({
			enableAutoTagging: false,
			enableAutoCcipExtraction: false,
		});
		directory = await fs.mkdtemp(path.join(os.tmpdir(), "file-producers-"));
		await fs.copyFile(
			"src/tests/fixtures/test-image-with-metadata.png",
			path.join(directory, "image.png"),
		);
		sourceId = (
			await services.getSourceRepository().create({
				name: "File producers",
				description: null,
				type: "local",
				connectionInfo: { path: directory },
			})
		).id;
	});
	afterEach(async () => {
		vi.restoreAllMocks();
		await db.delete(mediaSources).where(eq(mediaSources.id, sourceId));
		await fs.rm(getSourceCacheDir(sourceId), { recursive: true, force: true });
		await fs.rm(directory, { recursive: true, force: true });
	});
	const restoredMedia = async () => {
		await BackupService.restoreSource(sourceId, [dump]);
		const media = await services
			.getMediaRepository()
			.findByPath(sourceId, "image.png");
		if (!media) throw new Error("Missing restored fixture");
		return media;
	};
	it("restores metadata and relations atomically while reserving only thumbnail work", async () => {
		const media = await restoredMedia();
		expect(
			await MediaProcessingStateRepository.findByMediaIds([media.id]),
		).toEqual([
			expect.objectContaining({
				taskKind: "thumbnail",
				executionMode: "scheduled",
				status: "pending",
			}),
		]);
		expect(
			await db.select().from(jobs).where(eq(jobs.mediaSourceId, sourceId)),
		).toHaveLength(0);
		await services.getMediaProcessingService().runFileTask("thumbnail");
		await fs.access(getThumbnailPath(sourceId, media.id, 512));
		await fs.access(getThumbnailPath(sourceId, media.id, 256));
		expect(
			(await services.getMediaRepository().getGenerationInfo(media.id))?.prompt,
		).toBe("restored prompt");
		expect(await services.getTagRepository().findByMediaId(media.id)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "restored-tag" }),
			]),
		);
	});
	it("rolls back restored media, generation info and relations when request reservation fails", async () => {
		vi.spyOn(
			services.getMediaProcessingService(),
			"requestTask",
		).mockRejectedValueOnce(new Error("request unavailable"));
		await expect(BackupService.restoreSource(sourceId, [dump])).rejects.toThrow(
			"request unavailable",
		);
		expect(
			await db.select().from(medias).where(eq(medias.mediaSourceId, sourceId)),
		).toHaveLength(0);
	});
	it("coalesces thumbnail cache miss bursts without generic job records", async () => {
		const media = await restoredMedia();
		const initial = await MediaProcessingStateRepository.findByMediaIds([
			media.id,
		]);
		await Promise.all(
			Array.from({ length: 12 }, () =>
				queueThumbnailGeneration(sourceId, media.id, 256),
			),
		);
		expect(
			await MediaProcessingStateRepository.findByMediaIds([media.id]),
		).toEqual(initial);
		expect(
			await db.select().from(jobs).where(eq(jobs.mediaSourceId, sourceId)),
		).toHaveLength(0);
	});
	it("batch children observe a fixed dedicated request while its worker publishes both sizes", async () => {
		const media = await restoredMedia();
		const first = await generateThumbnailsForSource(sourceId, {
			size: 512,
			missingOnly: false,
		});
		expect(first.count).toBe(1);
		const [child] = await services
			.getJobRepository()
			.claimPending(1, { includeTypes: ["generate_thumbnail"] });
		expect(child.payload).toMatchObject({
			processingRequest: {
				requestId: expect.any(String),
				requestedRevision: expect.any(String),
			},
		});
		const observing = processThumbnailGenerationJob(child);
		await services.getMediaProcessingService().runFileTask("thumbnail");
		await observing;
		expect(
			(await services.getJobRepository().findById(first.jobId ?? ""))?.status,
		).toBe("completed");
		await fs.access(getThumbnailPath(sourceId, media.id, 256));
	});
	it("coalesces overlapping batch reservations under the existing child uniqueness rule", async () => {
		await restoredMedia();
		expect(
			(
				await generateThumbnailsForSource(sourceId, {
					size: 512,
					missingOnly: false,
				})
			).count,
		).toBe(1);
		expect(
			(
				await generateThumbnailsForSource(sourceId, {
					size: 512,
					missingOnly: false,
				})
			).count,
		).toBe(0);
		expect(
			await db
				.select()
				.from(jobs)
				.where(
					and(
						eq(jobs.mediaSourceId, sourceId),
						eq(jobs.type, "generate_thumbnail"),
					),
				),
		).toHaveLength(1);
	});
	it("watcher changes update indexed input and both dedicated requests without processMedia", async () => {
		const media = await restoredMedia();
		await FileWatcherService.startMonitoring(sourceId);
		const callbacks = vi
			.mocked(FileWatcherManager.start)
			.mock.calls.at(-1)?.[2];
		if (!callbacks) throw new Error("Missing watcher callbacks");
		const changed = new Date("2026-08-01T00:00:00Z");
		await fs.utimes(path.join(directory, "image.png"), changed, changed);
		await callbacks.onChange("image.png");
		expect(
			(await services.getMediaRepository().findById(media.id))?.modifiedAt,
		).toEqual(changed);
		expect(
			await MediaProcessingStateRepository.findByMediaIds([media.id]),
		).toHaveLength(2);
		expect(
			await db.select().from(jobs).where(eq(jobs.mediaSourceId, sourceId)),
		).toHaveLength(0);
	});
	it("binds historical force jobs once and preserves terminal failure after observer recovery", async () => {
		const media = await restoredMedia();
		await services.getMediaProcessingService().runFileTask("thumbnail");
		const repository = services.getJobRepository();
		const created = await repository.create({
			type: "generate_thumbnail",
			mediaSourceId: sourceId,
			payload: { mediaId: media.id, size: 512, force: true },
		});
		const [first] = await repository.claimPending(1, {
			includeTypes: ["generate_thumbnail"],
		});
		vi.spyOn(ImageProcessor, "generateThumbnail").mockRejectedValueOnce(
			new Error("invalid file"),
		);
		const observing = processThumbnailGenerationJob(first);
		const rejected = expect(observing).rejects.toThrow("invalid file");
		await vi.waitFor(async () =>
			expect((await repository.findById(created.id))?.payload).toMatchObject({
				force: false,
				processingRequest: { requestId: expect.any(String) },
			}),
		);
		expect(
			await services.getMediaProcessingService().runFileTask("thumbnail"),
		).toBe("failed");
		await rejected;
		const terminal = await MediaProcessingStateRepository.findByMediaIds([
			media.id,
		]);
		// Simulate stale generic-job recovery after domain failure, before job failure was saved.
		await repository.update(created.id, { status: "pending" });
		const [recovered] = await repository.claimPending(1, {
			includeTypes: ["generate_thumbnail"],
		});
		await expect(processThumbnailGenerationJob(recovered)).rejects.toThrow(
			"invalid file",
		);
		expect(
			await MediaProcessingStateRepository.findByMediaIds([media.id]),
		).toEqual(terminal);
	});
	it("explicitly retries a failed batch request and persists its replacement identity", async () => {
		const media = await restoredMedia();
		await generateThumbnailsForSource(sourceId, {
			size: 512,
			missingOnly: false,
		});
		const repository = services.getJobRepository();
		const [first] = await repository.claimPending(1, {
			includeTypes: ["generate_thumbnail"],
		});
		vi.spyOn(ImageProcessor, "generateThumbnail").mockRejectedValueOnce(
			new Error("invalid file"),
		);
		await services.getMediaProcessingService().runFileTask("thumbnail");
		const previous = (
			await MediaProcessingStateRepository.findByMediaIds([media.id])
		)[0];
		await expect(processThumbnailGenerationJob(first)).rejects.toThrow(
			"invalid file",
		);
		await repository.markAsFailed(
			first.id,
			"invalid file",
			first.attemptCount ?? 0,
		);
		await repository.update(first.id, {
			status: "pending",
			payload: {
				...(typeof first.payload === "object" ? first.payload : {}),
				retryFileTasks: true,
			},
		});
		const [second] = await repository.claimPending(1, {
			includeTypes: ["generate_thumbnail"],
		});
		const observing = processThumbnailGenerationJob(second);
		await vi.waitFor(async () =>
			expect(
				(await MediaProcessingStateRepository.findByMediaIds([media.id]))[0],
			).toMatchObject({ status: "pending" }),
		);
		await services.getMediaProcessingService().runFileTask("thumbnail");
		await observing;
		const completed = (
			await MediaProcessingStateRepository.findByMediaIds([media.id])
		)[0];
		expect(completed.requestId).not.toBe(previous.requestId);
		expect(completed.status).toBe("completed");
		expect((await repository.findById(first.id))?.payload).toMatchObject({
			retryFileTasks: false,
			processingRequest: { requestId: completed.requestId },
		});
	});
});
