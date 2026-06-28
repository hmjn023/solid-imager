import fs from "node:fs/promises";
import path from "node:path";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import { getSourceCacheDir } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";

export class MaintenanceService {
	private readonly mediaRepo: IMediaRepository;
	private readonly jobRepo: IJobRepository;
	private readonly sourceRepo: SourceRepository;

	constructor(
		mediaRepo: IMediaRepository,
		jobRepo: IJobRepository,
		sourceRepo: SourceRepository,
	) {
		this.mediaRepo = mediaRepo;
		this.jobRepo = jobRepo;
		this.sourceRepo = sourceRepo;
	}

	/**
	 * Performs startup checks to ensure data consistency and recovery.
	 */
	async performStartupChecks(): Promise<void> {
		logger.info("Starting startup checks...");
		try {
			await this.queueMissingMetadata();
			await this.queueMissingThumbnails();
			await this.queueLanceDbCacheSync();
			logger.info("Startup checks completed.");
		} catch (err) {
			logger.error({ err }, "Startup checks failed");
		}
	}

	private async queueMissingMetadata() {
		try {
			const missing = await this.mediaRepo.findIdsWithMissingGenerationInfo();
			if (missing.length === 0) {
				return;
			}

			logger.info(
				{ count: missing.length },
				"Found media with missing metadata. Queueing jobs...",
			);
			// If metadata is missing, we prioritize fetching it.
			// We skip thumbnail generation here to avoid redundant work, assuming queueMissingThumbnails handles that.
			await this.dispatchJobs(missing, { skipThumbnailGeneration: true });
		} catch (error) {
			logger.error({ err: error }, "Failed to queue missing metadata jobs");
		}
	}

	private async queueMissingThumbnails() {
		try {
			const BATCH_SIZE = 1000;
			let lastId: string | undefined;
			let hasMore = true;

			while (hasMore) {
				const batch = await this.mediaRepo.findAllMediaIndices({
					limit: BATCH_SIZE,
					afterId: lastId,
				});

				if (batch.length === 0) {
					hasMore = false;
					break;
				}

				const missingInBatch = await this.findMissingThumbnails(batch);

				if (missingInBatch.length > 0) {
					logger.info(
						{ count: missingInBatch.length, afterId: lastId },
						"Found media with missing thumbnails in batch. Queueing jobs...",
					);
					await this.dispatchJobs(missingInBatch, {
						skipMetadataExtraction: true,
					});
				}

				lastId = batch.at(-1)?.id ?? lastId;
				if (batch.length < BATCH_SIZE) {
					hasMore = false;
				}
			}
		} catch (error) {
			logger.error({ err: error }, "Failed to queue missing thumbnail jobs");
		}
	}

	private async queueLanceDbCacheSync() {
		try {
			const sources = await this.sourceRepo.findAll();
			let queuedCount = 0;

			for (const source of sources) {
				const hasCache = await this.hasLanceDbCache(source.id);
				let jobType: "sync_lancedb_full" | "sync_lancedb_delta" =
					"sync_lancedb_full";

				if (hasCache) {
					try {
						const cacheDir = await this.getLanceDbCacheDir(source.id);
						const { readMediaIds } = await import(
							"~/application/services/lancedb-dump-service"
						);
						const lanceDbIds = await readMediaIds(cacheDir);
						const postgresMedias = await this.mediaRepo.findAllPathsBySourceId(
							source.id,
						);

						const postgresIdsSet = new Set(postgresMedias.map((m) => m.id));
						const lanceDbIdsSet = new Set(lanceDbIds);

						// PostgreSQL にあって LanceDB にない -> 追加 (upsert)
						const toUpsert = postgresMedias
							.filter((m) => !lanceDbIdsSet.has(m.id))
							.map((m) => m.id);

						// LanceDB にあって PostgreSQL にない -> 削除 (delete)
						const toDelete = lanceDbIds.filter((id) => !postgresIdsSet.has(id));

						if (toUpsert.length > 0 || toDelete.length > 0) {
							logger.info(
								{
									sourceId: source.id,
									toUpsertCount: toUpsert.length,
									toDeleteCount: toDelete.length,
								},
								"Found discrepancies between PostgreSQL and LanceDB on startup. Queueing delta sync.",
							);

							const { BackupService } = await import(
								"~/application/services/backup-service"
							);

							if (toUpsert.length > 0) {
								await BackupService.queueSourceLanceDBDelta(
									source.id,
									toUpsert,
									"upsert",
									{ enqueueJob: false },
								);
							}
							if (toDelete.length > 0) {
								await BackupService.queueSourceLanceDBDelta(
									source.id,
									toDelete,
									"delete",
									{ enqueueJob: false },
								);
							}
						}

						jobType = "sync_lancedb_delta";
					} catch (compareError) {
						logger.error(
							{ err: compareError, sourceId: source.id },
							"Failed to compare PostgreSQL and LanceDB on startup. Falling back to full sync.",
						);
						jobType = "sync_lancedb_full";
					}
				}

				const created = await this.jobRepo.createIfUnique({
					type: jobType,
					mediaSourceId: source.id,
					payload: { reason: "startup" },
				});
				if (created) {
					queuedCount++;
				}
			}

			if (queuedCount > 0) {
				logger.info(
					{ count: queuedCount },
					"Queued LanceDB cache sync jobs for startup",
				);
			}
		} catch (error) {
			logger.error({ err: error }, "Failed to queue LanceDB cache sync jobs");
		}
	}

	private async getLanceDbCacheDir(sourceId: string): Promise<string> {
		const { services } = await import("~/application/registry");
		const config = services.getConfigService().getConfig();
		const baseCacheDir = config.lancedb?.cacheDir ?? ".cache/lancedb-cache";
		return path.resolve(process.cwd(), baseCacheDir, `source-${sourceId}`);
	}

	private async hasLanceDbCache(sourceId: string): Promise<boolean> {
		const cacheDir = await this.getLanceDbCacheDir(sourceId);
		const manifestPath = path.join(cacheDir, "manifest.json");
		try {
			const content = await fs.readFile(manifestPath, "utf-8");
			const manifest = JSON.parse(content) as { version?: unknown };
			return manifest.version === 3;
		} catch {
			return false;
		}
	}

	private async findMissingThumbnails(
		batch: { id: string; mediaSourceId: string; filePath: string }[],
	) {
		const missing: typeof batch = [];
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

	private groupMediaBySource(
		batch: { id: string; mediaSourceId: string; filePath: string }[],
	) {
		const mediaBySource = new Map<string, typeof batch>();
		for (const media of batch) {
			if (!mediaBySource.has(media.mediaSourceId)) {
				mediaBySource.set(media.mediaSourceId, []);
			}
			mediaBySource.get(media.mediaSourceId)?.push(media);
		}
		return mediaBySource;
	}

	private async getExistingThumbnails(sourceId: string) {
		const cacheDir = getSourceCacheDir(sourceId);
		try {
			const files = await fs.readdir(cacheDir);
			return new Set(files.map((f) => path.basename(f, path.extname(f))));
		} catch (error) {
			if ((error as { code?: string }).code === "ENOENT") {
				return new Set<string>();
			}
			logger.warn(
				{ err: error, sourceId },
				"Failed to read thumbnail directory",
			);
			return null;
		}
	}

	private async dispatchJobs(
		items: { id: string; mediaSourceId: string; filePath: string }[],
		options: {
			skipMetadataExtraction?: boolean;
			skipThumbnailGeneration?: boolean;
		},
	) {
		// Resolve source paths efficiently
		const sourceIds = [...new Set(items.map((i) => i.mediaSourceId))];
		const sources = new Map<string, string>(); // id -> path

		await Promise.all(
			sourceIds.map(async (sid) => {
				const source = await this.sourceRepo.findById(sid);
				if (source?.type === "local") {
					// For local sources, we expect connectionInfo to have a path string
					const sourcePath = (source.connectionInfo as { path?: string }).path;
					if (typeof sourcePath === "string" && sourcePath) {
						sources.set(sid, sourcePath);
					} else {
						logger.warn(
							{ sourceId: sid },
							"Invalid local source config: path is missing or invalid",
						);
					}
				}
			}),
		);

		let queuedCount = 0;
		const CHUNK_SIZE = 50;

		for (let i = 0; i < items.length; i += CHUNK_SIZE) {
			const chunk = items.slice(i, i + CHUNK_SIZE);
			const results = await Promise.allSettled(
				chunk.map(async (item) => {
					const basePath = sources.get(item.mediaSourceId);
					if (!basePath) {
						return false; // Skip non-local or missing sources
					}

					try {
						return await this.jobRepo.createIfUnique({
							type: "processMedia",
							mediaSourceId: item.mediaSourceId,
							payload: {
								mediaId: item.id,
								sourcePath: basePath,
								type: "processMedia", // Legacy payload requirement
								...options,
							},
						});
					} catch (err) {
						logger.error(
							{ err, mediaId: item.id },
							"Failed to queue media process job",
						);
						return false;
					}
				}),
			);

			queuedCount += results.filter(
				(r) => r.status === "fulfilled" && r.value,
			).length;
		}

		if (queuedCount > 0) {
			logger.info({ count: queuedCount }, "Dispatched recovery jobs");
		}
	}
}
