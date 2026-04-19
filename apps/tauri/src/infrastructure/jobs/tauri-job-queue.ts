import { defaultAppConfig } from "@solid-imager/core/domain/config/config-schema";
import { emit } from "@tauri-apps/api/event";
import { appDataDir, isAbsolute, join } from "@tauri-apps/api/path";
import { getTauriAppServices } from "~/app-services";
import { TauriMediaRepository } from "../local-api/repositories/media-repository";
import { TauriTagRepository } from "../local-api/repositories/tag-repository";
import { TauriJobRepository } from "../local-api/repositories/tauri-job-repository";
import { TauriConfigService } from "../local-api/services/config-service";
import type { PersistedThumbnailJob, ThumbnailJob } from "./thumbnail-job";

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

class TauriJobQueue {
	private queue: PersistedThumbnailJob[] = [];
	private running = 0;
	private sourceCounters = new Map<string, SourceCounter>();
	private concurrency = defaultAppConfig.jobs.concurrency;
	private initializationPromise: Promise<void> | null = null;

	constructor() {
		TauriConfigService.onChange((config) => {
			this.concurrency = config.jobs.concurrency;
			this.drain();
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

	async enqueue(jobs: ThumbnailJob[]): Promise<void> {
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
		await TauriJobRepository.resetInProgressToPending();
		const pendingJobs = await TauriJobRepository.findPending();
		for (const job of pendingJobs) {
			this.enqueueInMemory(job);
		}
		this.drain();
	}

	private enqueueInMemory(job: PersistedThumbnailJob): void {
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

	private async processJob(job: PersistedThumbnailJob): Promise<void> {
		try {
			await TauriJobRepository.markAsInProgress(job.id);

			// Step 1: metadata extraction (mirrors server executeProcessMediaJob)
			try {
				const metadata =
					await getTauriAppServices().imageProcessor.extractMetadata(
						job.fullPath,
					);
				await TauriMediaRepository.upsertGenerationInfo(
					job.mediaId,
					typeof metadata.prompt === "object" && metadata.prompt !== null
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
			} catch (metaErr) {
				console.warn(
					"[jobs] metadata extraction failed, continuing:",
					job.mediaId,
					metaErr,
				);
			}

			// Step 2: thumbnail generation
			const config = await TauriConfigService.getConfig();
			const basePath = await resolveThumbnailBasePath(
				config.storage.thumbnailDir,
			);
			const outputPath = buildThumbnailPath(
				basePath,
				job.sourceId,
				job.mediaId,
			);
			await getTauriAppServices().imageProcessor.generateThumbnail(
				job.fullPath,
				outputPath,
				config.storage.thumbnailSize,
				config.storage.thumbnailQuality,
			);
			await emit("thumbnail-generated", {
				mediaSourceId: job.sourceId,
				mediaId: job.mediaId,
				filePath: job.filePath,
				timestamp: new Date().toISOString(),
			});
			await TauriJobRepository.markAsCompleted(job.id);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Unknown thumbnail job error";
			console.error("[jobs] thumbnail generation failed:", job.mediaId, err);
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
