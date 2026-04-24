import { JobWorker } from "@solid-imager/application/services/job-worker";
import { runProcessMediaJob } from "@solid-imager/application/services/process-media-runner";
import { defaultAppConfig } from "@solid-imager/core/domain/config/config-schema";
import { emit } from "@tauri-apps/api/event";
import { appDataDir, isAbsolute, join } from "@tauri-apps/api/path";
import { getTauriAppServices } from "~/app-services";
import { TauriMediaRepository } from "../local-api/repositories/media-repository";
import { TauriTagRepository } from "../local-api/repositories/tag-repository";
import { TauriJobRepository } from "../local-api/repositories/tauri-job-repository";
import { TauriAiService } from "../local-api/services/ai-service";
import { TauriConfigService } from "../local-api/services/config-service";
import type {
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

function isAutoTaggingPayload(value: unknown): value is { mediaId: string } {
	return (
		typeof value === "object" &&
		value !== null &&
		"mediaId" in value &&
		typeof value.mediaId === "string"
	);
}

class TauriJobQueue {
	private readonly sourceCounters = new Map<string, SourceCounter>();
	private readonly worker = new JobWorker({
		jobRepository: TauriJobRepository,
		processor: async (job) => {
			if (job.type === "processMedia") {
				await this.processMediaJob(job);
				return;
			}
			if (job.type === "auto_tagging") {
				await this.processAutoTaggingJob(job.payload);
			}
		},
		logger: console,
	});
	private initializationPromise: Promise<void> | null = null;

	constructor() {
		this.worker.updateConfig(defaultAppConfig);
		TauriConfigService.onChange((config) => {
			this.worker.updateConfig(config);
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
		const persistedJobs = await TauriJobRepository.createManyProcessMedia(jobs);
		this.enqueuePersisted(persistedJobs);
	}

	enqueuePersisted(jobs: PersistedProcessMediaJob[]): void {
		for (const job of jobs) {
			this.registerSourceCounter(job.sourceId);
		}
		this.worker.wake();
	}

	registerQueuedSources(sourceIds: string[]): void {
		for (const sourceId of sourceIds) {
			this.registerSourceCounter(sourceId);
		}
		this.worker.wake();
	}

	wake(): void {
		this.worker.wake();
	}

	private async initializeInternal(): Promise<void> {
		const config = await TauriConfigService.getConfig();
		this.worker.updateConfig(config);
		await TauriJobRepository.resetInProgressToPending({
			includeTypes: ["processMedia", "auto_tagging"],
		});
		this.worker.start();
	}

	private registerSourceCounter(sourceId: string): void {
		const counter = this.sourceCounters.get(sourceId) ?? {
			total: 0,
			done: 0,
		};
		counter.total++;
		this.sourceCounters.set(sourceId, counter);
	}

	private async processMediaJob(job: {
		id: string;
		mediaSourceId: string | null;
		payload: unknown;
	}): Promise<void> {
		try {
			await runProcessMediaJob(job, {
				mediaRepository: TauriMediaRepository,
				tagRepository: TauriTagRepository,
				pathJoin: join,
				extractMetadata: async (fullPath) =>
					await getTauriAppServices().imageProcessor.extractMetadata(fullPath),
				generateThumbnail: async ({ media, mediaSourceId, fullPath }) => {
					const config = await TauriConfigService.getConfig();
					const basePath = await resolveThumbnailBasePath(
						config.storage.thumbnailDir,
					);
					const outputPath = buildThumbnailPath(
						basePath,
						mediaSourceId,
						media.id,
					);
					await getTauriAppServices().imageProcessor.generateThumbnail(
						fullPath,
						outputPath,
						config.storage.thumbnailSize,
						config.storage.thumbnailQuality,
					);
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
						payload: { mediaId, mediaSourceId },
					});
					this.worker.wake();
				},
				isAutoTaggingEnabled: async () =>
					(await TauriConfigService.getConfig()).jobs.enableAutoTagging,
				logger: console,
			});
		} finally {
			if (job.mediaSourceId) {
				await this.markDone(job.mediaSourceId);
			}
		}
	}

	private async processAutoTaggingJob(payload: unknown): Promise<void> {
		if (!isAutoTaggingPayload(payload)) {
			throw new Error("Invalid auto_tagging job payload");
		}
		await TauriAiService.tagSingleMedia(payload.mediaId);
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
