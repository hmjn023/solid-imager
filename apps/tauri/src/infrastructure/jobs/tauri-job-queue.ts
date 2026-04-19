import { defaultAppConfig } from "@solid-imager/core/domain/config/config-schema";
import { emit } from "@tauri-apps/api/event";
import { appDataDir, isAbsolute, join } from "@tauri-apps/api/path";
import { getTauriAppServices } from "~/app-services";
import { TauriMediaRepository } from "../local-api/repositories/media-repository";
import { TauriTagRepository } from "../local-api/repositories/tag-repository";
import {
	type PersistedAutoTaggingJob,
	TauriJobRepository,
} from "../local-api/repositories/tauri-job-repository";
import { TauriAiService } from "../local-api/services/ai-service";
import { TauriConfigService } from "../local-api/services/config-service";
import type {
	MediaProcessingStep,
	PersistedProcessMediaJob,
	ProcessMediaJob,
} from "./process-media-job";

type SourceCounter = {
	total: number;
	done: number;
};

async function resolveThumbnailBasePath(thumbnailDir: string): Promise<string> {
	if (await isAbsolute(thumbnailDir)) return thumbnailDir;
	return join(await appDataDir(), thumbnailDir);
}

function buildThumbnailPath(
	basePath: string,
	sourceId: string,
	mediaId: string,
): string {
	const sep = basePath.includes("\\") ? "\\" : "/";
	return `${basePath.replace(/[\\/]+$/, "")}${sep}${sourceId}${sep}${mediaId}.webp`;
}

function hasMediaProcessingStep(
	steps: MediaProcessingStep[] | undefined,
	step: MediaProcessingStep,
): boolean {
	if (!steps || steps.length === 0) return true;
	return steps.includes(step);
}

class TauriJobQueue {
	private queue: PersistedProcessMediaJob[] = [];
	private running = 0;
	private sourceCounters = new Map<string, SourceCounter>();
	private concurrency = defaultAppConfig.jobs.concurrency;
	private aiQueue: PersistedAutoTaggingJob[] = [];
	private aiRunning = 0;
	private aiConcurrency = defaultAppConfig.jobs.aiConcurrency;
	private initializationPromise: Promise<void> | null = null;

	constructor() {
		TauriConfigService.onChange((config) => {
			this.concurrency = config.jobs.concurrency;
			this.aiConcurrency = config.jobs.aiConcurrency;
			this.drain();
			this.drainAi();
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

	async enqueue(jobs: ProcessMediaJob[]): Promise<void> {
		if (jobs.length === 0) {
			return;
		}

		await this.initialize();
		const persistedJobs = await TauriJobRepository.createMany(jobs);
		for (const job of persistedJobs) {
			this.enqueueInMemory(job);
		}
		this.drain();
	}

	private async initializeInternal(): Promise<void> {
		const config = await TauriConfigService.getConfig();
		this.concurrency = config.jobs.concurrency;
		this.aiConcurrency = config.jobs.aiConcurrency;
		await TauriJobRepository.resetInProgressToPending();
		await TauriJobRepository.resetInProgressAutoTaggingToPending();
		const pendingJobs = await TauriJobRepository.findPending();
		for (const job of pendingJobs) {
			this.enqueueInMemory(job);
		}
		this.drain();
		if (config.jobs.enableAutoTagging) {
			const pendingAiJobs = await TauriJobRepository.findPendingAutoTagging();
			for (const job of pendingAiJobs) {
				this.enqueueAiInMemory(job);
			}
			this.drainAi();
		}
	}

	private enqueueInMemory(job: PersistedProcessMediaJob): void {
		const counter = this.sourceCounters.get(job.sourceId) ?? {
			total: 0,
			done: 0,
		};
		counter.total++;
		this.sourceCounters.set(job.sourceId, counter);
		this.queue.push(job);
	}

	private drain(): void {
		while (this.running < this.concurrency && this.queue.length > 0) {
			const job = this.queue.shift();
			if (!job) {
				return;
			}
			this.running++;
			void this.processJob(job).finally(() => {
				this.running--;
				this.drain();
			});
		}
	}

	private async processJob(job: PersistedProcessMediaJob): Promise<void> {
		try {
			await TauriJobRepository.markAsInProgress(job.id);

			const media = await TauriMediaRepository.findById(job.mediaId);
			if (!media) {
				console.warn("[jobs] media not found, skipping:", job.mediaId);
				await TauriJobRepository.markAsCompleted(job.id);
				return;
			}

			const fullPath = await join(job.sourcePath, media.filePath);

			// Step 1: Metadata extraction
			if (hasMediaProcessingStep(job.steps, "extractMetadata")) {
				try {
					const metadata =
						await getTauriAppServices().imageProcessor.extractMetadata(
							fullPath,
						);
					await TauriMediaRepository.upsertGenerationInfo(
						job.mediaId,
						metadata.prompt !== null && typeof metadata.prompt === "object"
							? JSON.stringify(metadata.prompt)
							: (metadata.prompt as string | null),
						metadata.workflow as object | null,
					);
					if (metadata.tags.length > 0) {
						await TauriTagRepository.addTagsToMedia(
							job.mediaId,
							metadata.tags,
							"comfyui_workflow",
						);
					}
				} catch (err) {
					console.warn(
						"[jobs] metadata extraction failed, continuing:",
						job.mediaId,
						err,
					);
				}
			}

			// Step 2: Thumbnail generation
			const config = await TauriConfigService.getConfig();
			if (hasMediaProcessingStep(job.steps, "generateThumbnail")) {
				try {
					const basePath = await resolveThumbnailBasePath(
						config.storage.thumbnailDir,
					);
					const outputPath = buildThumbnailPath(
						basePath,
						job.sourceId,
						job.mediaId,
					);
					await getTauriAppServices().imageProcessor.generateThumbnail(
						fullPath,
						outputPath,
						config.storage.thumbnailSize,
						config.storage.thumbnailQuality,
					);
					await emit("thumbnail-generated", {
						mediaSourceId: job.sourceId,
						mediaId: job.mediaId,
						filePath: media.filePath,
						timestamp: new Date().toISOString(),
					});
				} catch (err) {
					console.error(
						"[jobs] thumbnail generation failed:",
						job.mediaId,
						err,
					);
				}
			}

			await TauriJobRepository.markAsCompleted(job.id);

			// Step 3: Queue auto_tagging if enabled and media is an image
			if (
				config.jobs.enableAutoTagging &&
				hasMediaProcessingStep(job.steps, "queueAutoTagging")
			) {
				try {
					if (media.mediaType === "image") {
						const aiJob = await TauriJobRepository.createAutoTaggingJob(
							job.mediaId,
							job.sourceId,
						);
						this.enqueueAiInMemory(aiJob);
						this.drainAi();
					}
				} catch (err) {
					console.error(
						"[jobs] failed to queue auto_tagging:",
						job.mediaId,
						err,
					);
				}
			}
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Unknown processMedia job error";
			console.error("[jobs] media processing failed:", job.mediaId, err);
			try {
				await TauriJobRepository.markAsFailed(job.id, message);
			} catch (updateError) {
				console.error(
					"[jobs] failed to persist job failure:",
					job.mediaId,
					updateError,
				);
			}
		} finally {
			await this.markDone(job.sourceId);
		}
	}

	private enqueueAiInMemory(job: PersistedAutoTaggingJob): void {
		this.aiQueue.push(job);
	}

	private drainAi(): void {
		while (this.aiRunning < this.aiConcurrency && this.aiQueue.length > 0) {
			const job = this.aiQueue.shift();
			if (!job) return;
			this.aiRunning++;
			void this.processAiJob(job).finally(() => {
				this.aiRunning--;
				this.drainAi();
			});
		}
	}

	private async processAiJob(job: PersistedAutoTaggingJob): Promise<void> {
		try {
			await TauriJobRepository.markAsInProgress(job.id);
			await TauriAiService.tagSingleMedia(job.mediaId);
			await TauriJobRepository.markAsCompleted(job.id);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Unknown AI job error";
			console.error("[jobs] auto_tagging failed:", job.mediaId, err);
			try {
				await TauriJobRepository.markAsFailed(job.id, message);
			} catch (updateError) {
				console.error(
					"[jobs] failed to persist AI job failure:",
					job.mediaId,
					updateError,
				);
			}
		}
	}

	private async markDone(sourceId: string): Promise<void> {
		const counter = this.sourceCounters.get(sourceId);
		if (!counter) return;
		counter.done++;

		try {
			await emit("job-progress", {
				jobId: sourceId,
				processed: counter.done,
				total: counter.total,
			});
		} catch (err) {
			console.error("[jobs] failed to emit job-progress:", err);
		}

		if (counter.done >= counter.total) {
			this.sourceCounters.delete(sourceId);
			try {
				await emit("all-jobs-completed", {
					mediaSourceId: sourceId,
					processed: counter.total,
				});
			} catch (err) {
				console.error("[jobs] failed to emit all-jobs-completed:", err);
			}
		}
	}
}

export const tauriJobQueue = new TauriJobQueue();
