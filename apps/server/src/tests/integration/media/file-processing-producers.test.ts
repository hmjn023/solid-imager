import { SourceRunRepository } from "~/infrastructure/repositories/source-run-repository";
import { sourceRunService } from "~/infrastructure/services/source-run-service";
import { BatchRunRepository } from "~/infrastructure/repositories/batch-run-repository";
import { batchRunService } from "~/infrastructure/services/batch-run-service";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "~/infrastructure/db";
import {
	mediaSources,
	medias,
	jobs,
	batchRuns,
} from "~/infrastructure/db/schema";
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
		await services.getJobWorker().stop();
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
		await db
			.delete(batchRuns)
			.where(sql`${batchRuns.input}->>'mediaSourceId' = ${sourceId}`);
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

	const dispatchBatch = async () => {
		const [claim] = await BatchRunRepository.claimPending(1);
		if (!claim) throw new Error("Batch claim missing");
		await batchRunService.dispatch(claim);
		await batchRunService.reconcile();
	};
	it("batch items observe a fixed request while one worker publishes both sizes", async () => {
		const media = await restoredMedia();
		const batch = await generateThumbnailsForSource(sourceId, {
			size: 512,
			missingOnly: false,
		});
		expect(batch.count).toBe(1);
		await dispatchBatch();
		expect(
			(await BatchRunRepository.listItems(batch.jobId ?? "", 100, 0)).items[0],
		).toMatchObject({ status: "scheduled", requestId: expect.any(String) });
		await services.getMediaProcessingService().runFileTask("thumbnail");
		expect(
			(await BatchRunRepository.findById(batch.jobId ?? ""))?.run.status,
		).toBe("completed");
		await fs.access(getThumbnailPath(sourceId, media.id, 256));
		await fs.access(getThumbnailPath(sourceId, media.id, 512));
	});
	it("keeps distinct batch histories while coalescing overlapping processing requests", async () => {
		await restoredMedia();
		const first = await generateThumbnailsForSource(sourceId, {
			size: 512,
			missingOnly: false,
		});
		const second = await generateThumbnailsForSource(sourceId, {
			size: 512,
			missingOnly: false,
		});
		expect(first.count).toBe(1);
		expect(second.count).toBe(1);
		await dispatchBatch();
		await dispatchBatch();
		const a = (await BatchRunRepository.listItems(first.jobId ?? "", 100, 0))
			.items[0];
		const b = (await BatchRunRepository.listItems(second.jobId ?? "", 100, 0))
			.items[0];
		expect(a.id).not.toBe(b.id);
		expect(a.requestId).toBe(b.requestId);
		expect(
			await db.select().from(jobs).where(eq(jobs.mediaSourceId, sourceId)),
		).toHaveLength(0);
	});
	it("watcher changes update indexed input and both dedicated requests without processMedia", async () => {
		const media = await restoredMedia();
		const monitoring = FileWatcherService.startMonitoring(sourceId);
		await vi.waitFor(async () =>
			expect(
				(
					await SourceRunRepository.list({
						sourceId,
						kind: "sync",
						status: "pending",
						limit: 1,
						offset: 0,
					})
				).total,
			).toBe(1),
		);
		const [sync] = await SourceRunRepository.claimPending(
			["sync"],
			1,
			sourceId,
		);
		await sourceRunService.process(sync, new AbortController().signal);
		await monitoring;
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

	it("keeps a terminal failure when the dispatcher is restarted", async () => {
		const media = await restoredMedia();
		const batch = await generateThumbnailsForSource(sourceId, {
			size: 512,
			missingOnly: false,
		});
		await dispatchBatch();
		vi.spyOn(ImageProcessor, "generateThumbnail").mockRejectedValueOnce(
			new Error("invalid file"),
		);
		expect(
			await services.getMediaProcessingService().runFileTask("thumbnail"),
		).toBe("failed");
		const terminal = await MediaProcessingStateRepository.findByMediaIds([
			media.id,
		]);
		expect(await BatchRunRepository.claimPending(1)).toEqual([]);
		await batchRunService.reconcile();
		expect(
			(await BatchRunRepository.findById(batch.jobId ?? ""))?.run.status,
		).toBe("failed");
		expect(
			await MediaProcessingStateRepository.findByMediaIds([media.id]),
		).toEqual(terminal);
	});
	it("explicit retry replaces only the failed request and retains its history", async () => {
		const media = await restoredMedia();
		const batch = await generateThumbnailsForSource(sourceId, {
			size: 512,
			missingOnly: false,
		});
		await dispatchBatch();
		vi.spyOn(ImageProcessor, "generateThumbnail").mockRejectedValueOnce(
			new Error("invalid file"),
		);
		await services.getMediaProcessingService().runFileTask("thumbnail");
		const previous = (
			await MediaProcessingStateRepository.findByMediaIds([media.id])
		)[0];
		await batchRunService.retry(batch.jobId ?? "");
		await dispatchBatch();
		await services.getMediaProcessingService().runFileTask("thumbnail");
		const completed = (
			await MediaProcessingStateRepository.findByMediaIds([media.id])
		)[0];
		expect(completed.status).toBe("completed");
		expect(completed.requestId).not.toBe(previous.requestId);
		const item = (await BatchRunRepository.listItems(batch.jobId ?? "", 100, 0))
			.items[0];
		expect(
			(await BatchRunRepository.listAttempts(item.id, 100, 0)).items.map(
				(attempt) => attempt.status,
			),
		).toEqual(["completed", "failed"]);
	});
});
