import { appDataDir, isAbsolute, join } from "@tauri-apps/api/path";
import { getTauriAppServices } from "~/app-services";
import type { PersistedProcessMediaJob } from "~/infrastructure/jobs/process-media-job";
import { tauriJobQueue } from "~/infrastructure/jobs/tauri-job-queue";
import { TauriMediaRepository } from "~/infrastructure/local-api/repositories/media-repository";
import { TauriSourceRepository } from "~/infrastructure/local-api/repositories/source-repository";
import { TauriJobRepository } from "~/infrastructure/local-api/repositories/tauri-job-repository";
import { TauriConfigService } from "~/infrastructure/local-api/services/config-service";

type MediaIndex = { id: string; mediaSourceId: string; filePath: string };

export class MaintenanceService {
	/**
	 * Performs startup checks to ensure data consistency and recovery.
	 */
	async performStartupChecks(): Promise<void> {
		console.info("[maintenance] Starting startup checks...");
		try {
			await this.queueMissingMetadata();
			await this.queueMissingThumbnails();
			console.info("[maintenance] Startup checks completed.");
		} catch (err) {
			console.error("[maintenance] Startup checks failed", err);
		}
	}

	private async queueMissingMetadata() {
		try {
			const missing =
				await TauriMediaRepository.findIdsWithMissingGenerationInfo();
			if (missing.length === 0) {
				return;
			}

			console.info(
				`[maintenance] Found ${missing.length} media with missing metadata. Queueing jobs...`,
			);
			await this.dispatchJobs(missing, {
				steps: ["extractMetadata", "queueAutoTagging"],
			});
		} catch (error) {
			console.error(
				"[maintenance] Failed to queue missing metadata jobs",
				error,
			);
		}
	}

	private async queueMissingThumbnails() {
		try {
			const BATCH_SIZE = 500;
			let offset = 0;
			let hasMore = true;

			while (hasMore) {
				const batch = await TauriMediaRepository.findAllMediaIndices(
					undefined,
					{
						limit: BATCH_SIZE,
						offset,
					},
				);

				if (batch.length === 0) {
					hasMore = false;
					break;
				}

				const missingInBatch = await this.findMissingThumbnails(batch);

				if (missingInBatch.length > 0) {
					console.info(
						`[maintenance] Found ${missingInBatch.length} media with missing thumbnails at offset ${offset}. Queueing jobs...`,
					);
					await this.dispatchJobs(missingInBatch, {
						steps: ["generateThumbnail"],
					});
				}

				offset += BATCH_SIZE;
				if (batch.length < BATCH_SIZE) {
					hasMore = false;
				}
			}
		} catch (error) {
			console.error(
				"[maintenance] Failed to queue missing thumbnail jobs",
				error,
			);
		}
	}

	private async findMissingThumbnails(batch: MediaIndex[]) {
		const missing: MediaIndex[] = [];
		const mediaBySource = this.groupMediaBySource(batch);

		for (const [sourceId, items] of mediaBySource) {
			const existingFiles = await this.getExistingThumbnails(sourceId);
			if (!existingFiles) {
				continue;
			}

			for (const item of items) {
				if (!existingFiles.has(item.id)) {
					missing.push(item);
				}
			}
		}
		return missing;
	}

	private groupMediaBySource(batch: MediaIndex[]) {
		const mediaBySource = new Map<string, MediaIndex[]>();
		for (const media of batch) {
			if (!mediaBySource.has(media.mediaSourceId)) {
				mediaBySource.set(media.mediaSourceId, []);
			}
			mediaBySource.get(media.mediaSourceId)?.push(media);
		}
		return mediaBySource;
	}

	private async getExistingThumbnails(sourceId: string) {
		const config = await TauriConfigService.getConfig();
		const thumbnailDir = config.storage.thumbnailDir;
		const fs = getTauriAppServices().fileSystem;

		let basePath = thumbnailDir;
		if (!(await isAbsolute(thumbnailDir))) {
			basePath = await join(await appDataDir(), thumbnailDir);
		}

		const sourceCacheDir = await join(basePath, sourceId);

		try {
			if (!(await fs.exists(sourceCacheDir))) {
				return new Set<string>();
			}
			const files = await fs.readdir(sourceCacheDir);
			return new Set(files.map((f) => f.replace(/\.[^/.]+$/, "")));
		} catch (error) {
			console.warn(
				`[maintenance] Failed to read thumbnail directory for source ${sourceId}`,
				error,
			);
			return null;
		}
	}

	private async dispatchJobs(
		items: MediaIndex[],
		options: {
			steps: Array<
				"extractMetadata" | "generateThumbnail" | "queueAutoTagging"
			>;
		},
	) {
		const sourceIds = [...new Set(items.map((i) => i.mediaSourceId))];
		const sources = new Map<string, string>();

		await Promise.all(
			sourceIds.map(async (sid) => {
				const source = await TauriSourceRepository.findById(sid);
				if (source?.type === "local") {
					const sourcePath = (source.connectionInfo as { path?: string }).path;
					if (sourcePath) {
						sources.set(sid, sourcePath);
					}
				}
			}),
		);

		let queuedCount = 0;
		const createdJobs: PersistedProcessMediaJob[] = [];
		await tauriJobQueue.initialize();

		for (const item of items) {
			const sourcePath = sources.get(item.mediaSourceId);
			if (!sourcePath) continue;

			try {
				const created = await TauriJobRepository.createIfUnique({
					sourceId: item.mediaSourceId,
					mediaId: item.id,
					sourcePath: sourcePath,
					steps: options.steps,
				});
				if (created) {
					createdJobs.push(created);
					queuedCount++;
				}
			} catch (err) {
				console.error(
					`[maintenance] Failed to queue job for media ${item.id}`,
					err,
				);
			}
		}

		if (queuedCount > 0) {
			console.info(`[maintenance] Dispatched ${queuedCount} recovery jobs`);
			tauriJobQueue.enqueuePersisted(createdJobs);
		}
	}
}
