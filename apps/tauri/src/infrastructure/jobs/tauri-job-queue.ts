import { emit } from "@tauri-apps/api/event";
import { appDataDir, isAbsolute, join } from "@tauri-apps/api/path";
import { getTauriAppServices } from "~/app-services";
import { TauriConfigService } from "../local-api/services/config-service";

export type ThumbnailJob = {
	sourceId: string;
	mediaId: string;
	filePath: string;
	fullPath: string;
};

type SourceCounter = {
	total: number;
	done: number;
};

const CONCURRENCY = 4;

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
	private queue: ThumbnailJob[] = [];
	private running = 0;
	private sourceCounters = new Map<string, SourceCounter>();

	enqueue(jobs: ThumbnailJob[]): void {
		for (const job of jobs) {
			const counter = this.sourceCounters.get(job.sourceId) ?? {
				total: 0,
				done: 0,
			};
			counter.total++;
			this.sourceCounters.set(job.sourceId, counter);
			this.queue.push(job);
		}
		this.drain();
	}

	private drain(): void {
		while (this.running < CONCURRENCY && this.queue.length > 0) {
			const job = this.queue.shift()!;
			this.running++;
			void this.processJob(job).finally(() => {
				this.running--;
				this.drain();
			});
		}
	}

	private async processJob(job: ThumbnailJob): Promise<void> {
		try {
			const config = await TauriConfigService.getConfig();
			const basePath = await resolveThumbnailBasePath(
				config.storage.thumbnailDir,
			);
			const outputPath = buildThumbnailPath(basePath, job.sourceId, job.mediaId);
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
		} catch (err) {
			console.error("[jobs] thumbnail generation failed:", job.mediaId, err);
		} finally {
			await this.markDone(job.sourceId);
		}
	}

	private async markDone(sourceId: string): Promise<void> {
		const counter = this.sourceCounters.get(sourceId);
		if (!counter) return;
		counter.done++;
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
