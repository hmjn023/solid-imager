import { SourceJobProgressTracker } from "@solid-imager/application/services/job-progress-tracker";
import {
	createJobDispatcher,
	NON_RUNNABLE_JOB_TYPES,
} from "@solid-imager/application/services/job-runtime";
import { JobWorker } from "@solid-imager/application/services/job-worker";
import {
	type ProcessMediaThumbnailInput,
	runProcessMediaBatchJobs,
} from "@solid-imager/application/services/process-media-runner";
import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import { defaultAppConfig } from "@solid-imager/core/domain/config/config-schema";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { appDataDir, isAbsolute, join } from "@tauri-apps/api/path";
import { getTauriAppServices } from "~/app-services";
import { processQueuedDownloadJob } from "./download-jobs";
import { TauriMediaRepository } from "../local-api/repositories/media-repository";
import { TauriTagRepository } from "../local-api/repositories/tag-repository";
import { TauriJobRepository } from "../local-api/repositories/tauri-job-repository";
import { TauriAiService } from "../local-api/services/ai-service";
import { TauriConfigService } from "../local-api/services/config-service";
import type { PersistedProcessMediaJob, ProcessMediaJob } from "./process-media-job";

const BATCH_SIZE = 16;

type ThumbnailBatchItem = {
	mediaPath: string;
	outputPath: string;
	size: number;
	quality: number;
};

type ThumbnailBatchItemResult = {
	mediaPath: string;
	error: string | null;
};

async function resolveThumbnailBasePath(thumbnailDir: string): Promise<string> {
	if (await isAbsolute(thumbnailDir)) return thumbnailDir;
	return join(await appDataDir(), thumbnailDir);
}

function buildThumbnailPath(basePath: string, sourceId: string, mediaId: string): string {
	const sep = basePath.includes("\\") ? "\\" : "/";
	return `${basePath.replace(/[\\/]+$/, "")}${sep}${sourceId}${sep}${mediaId}.webp`;
}

class TauriJobQueue {
	private readonly progressTracker = new SourceJobProgressTracker({
		jobProgress: async ({ sourceId, processed, total }) => {
			try {
				await emit("job-progress", {
					jobId: sourceId,
					processed,
					total,
				});
			} catch (err) {
				console.error("[jobs] failed to emit job-progress:", err);
			}
		},
		allJobsCompleted: async ({ sourceId, processed }) => {
			try {
				await emit("all-jobs-completed", {
					mediaSourceId: sourceId,
					processed,
				});
			} catch (err) {
				console.error("[jobs] failed to emit all-jobs-completed:", err);
			}
		},
	});
	private readonly worker = new JobWorker({
		jobRepository: TauriJobRepository,
		excludedJobTypes: [...NON_RUNNABLE_JOB_TYPES, "processMedia"],
		processor: createJobDispatcher({
			downloadImage: async (job) => {
				await processQueuedDownloadJob(job);
			},
			auto_tagging: async (job) => {
				await TauriAiService.processAutoTaggingJob(job);
			},
			bulk_tagging_dispatch: async (job) => {
				await TauriAiService.processBulkTaggingDispatchJob(job);
				this.worker.wake();
			},
		}),
		logger: console,
	});

	private batchPollActive = false;
	private batchPollPending = false;
	private batchPollTimer: ReturnType<typeof setTimeout> | null = null;
	private batchPollIntervalMs = defaultAppConfig.jobs.pollIntervalMs;

	private initializationPromise: Promise<void> | null = null;

	constructor() {
		this.worker.updateConfig(defaultAppConfig);
		TauriConfigService.onChange((config) => {
			this.updateConfig(config);
		});
	}

	async initialize(): Promise<void> {
		if (!this.initializationPromise) {
			this.initializationPromise = this.initializeInternal().catch((error) => {
				this.initializationPromise = null;
				throw error;
			});
		}
		await this.initializationPromise;
	}

	updateConfig(config: AppConfig): void {
		this.worker.updateConfig(config);
		this.batchPollIntervalMs = config.jobs.pollIntervalMs;
	}

	async resetRunnableJobs(): Promise<void> {
		await TauriJobRepository.resetInProgressToPending();
	}

	start(): void {
		this.worker.start();
		this.wakeBatch();
	}

	async enqueue(jobs: ProcessMediaJob[]): Promise<void> {
		if (jobs.length === 0) {
			return;
		}

		await this.initialize();
		const persistedJobs = await TauriJobRepository.createManyProcessMedia(jobs);
		this.enqueuePersisted(persistedJobs);
	}

	enqueuePersisted(jobs: PersistedProcessMediaJob[]): void {
		for (const job of jobs) {
			this.registerSourceCounter(job.sourceId);
		}
		this.wakeBatch();
	}

	registerQueuedSources(sourceIds: string[]): void {
		for (const sourceId of sourceIds) {
			this.registerSourceCounter(sourceId);
		}
		this.wakeBatch();
	}

	wake(): void {
		this.worker.wake();
		this.wakeBatch();
	}

	private async initializeInternal(): Promise<void> {
		const config = await TauriConfigService.getConfig();
		this.updateConfig(config);
		await this.resetRunnableJobs();
		this.start();
	}

	private registerSourceCounter(sourceId: string): void {
		this.progressTracker.register(sourceId);
	}

	private wakeBatch(): void {
		this.batchPollPending = true;
		if (this.batchPollTimer) {
			clearTimeout(this.batchPollTimer);
			this.batchPollTimer = null;
		}
		if (!this.batchPollActive) {
			this.batchPollActive = true;
			this.runBatchLoop().finally(() => {
				this.batchPollActive = false;
				this.scheduleBatchTimer();
			});
		}
	}

	private scheduleBatchTimer(): void {
		if (this.batchPollTimer) return;
		this.batchPollTimer = setTimeout(() => {
			this.batchPollTimer = null;
			this.wakeBatch();
		}, this.batchPollIntervalMs);
	}

	private async runBatchLoop(): Promise<void> {
		while (this.batchPollPending) {
			this.batchPollPending = false;
			try {
				const count = await this.doBatchMedia();
				if (count > 0) {
					this.batchPollPending = true;
				}
			} catch (err) {
				console.error("[jobs] Batch media poll error:", err);
			}
		}
	}

	private async doBatchMedia(): Promise<number> {
		const jobRecords = await TauriJobRepository.findPending(BATCH_SIZE, {
			includeTypes: ["processMedia"],
		});

		if (jobRecords.length === 0) return 0;

		for (const job of jobRecords) {
			await TauriJobRepository.markAsInProgress(job.id);
		}

		const results = await runProcessMediaBatchJobs(jobRecords, {
			mediaRepository: TauriMediaRepository,
			tagRepository: TauriTagRepository,
			pathJoin: join,
			extractMetadata: async (fullPath) =>
				await getTauriAppServices().imageProcessor.extractMetadata(fullPath),
			generateThumbnails: async (items) => {
				await this.generateThumbnails(items);
			},
			emitThumbnailGenerated: async ({ media, mediaSourceId }) => {
				await emit("thumbnail-generated", {
					mediaSourceId,
					mediaId: media.id,
					filePath: media.filePath,
					timestamp: new Date().toISOString(),
				});
			},
			queueAutoTagging: async ({ mediaId, mediaSourceId }) => {
				await TauriJobRepository.createIfUnique({
					type: "auto_tagging",
					mediaSourceId,
					payload: {
						mediaId,
					},
				});
				this.worker.wake();
			},
			isAutoTaggingEnabled: async () => {
				const config = await TauriConfigService.getConfig();
				return config.jobs.enableAutoTagging;
			},
			logger: console,
		});

		for (const result of results) {
			if (result.status === "failed") {
				await TauriJobRepository.markAsFailed(
					result.jobId,
					result.error ?? "Process media job failed",
				);
			} else {
				await TauriJobRepository.markAsCompleted(result.jobId, {
					success: true,
				});
			}
			if (result.mediaSourceId) {
				await this.progressTracker.markDone(result.mediaSourceId);
			}
		}

		return jobRecords.length;
	}

	private async generateThumbnails(items: ProcessMediaThumbnailInput[]): Promise<void> {
		const config = await TauriConfigService.getConfig();
		const basePath = await resolveThumbnailBasePath(config.storage.thumbnailDir);
		const thumbnailItems: ThumbnailBatchItem[] = items.map((item) => ({
			mediaPath: item.fullPath,
			outputPath: buildThumbnailPath(basePath, item.mediaSourceId, item.media.id),
			size: config.storage.thumbnailSize,
			quality: config.storage.thumbnailQuality,
		}));

		const thumbnailResults = await invoke<ThumbnailBatchItemResult[]>(
			"image_generate_thumbnails_batch",
			{ items: thumbnailItems },
		).catch((err) => {
			console.error("[jobs] Batch thumbnail generation failed:", err);
			return [] as ThumbnailBatchItemResult[];
		});

		for (const result of thumbnailResults) {
			if (result.error) {
				console.error(`[jobs] Thumbnail failed for ${result.mediaPath}: ${result.error}`);
			}
		}
	}
}

export const tauriJobQueue = new TauriJobQueue();
