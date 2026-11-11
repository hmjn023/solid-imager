import fs from "node:fs/promises";
import path from "node:path";
import {
	localConnectionSchema,
	type DirectorySyncResult,
	type MediaSourceSyncState,
} from "@solid-imager/core/sources";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { deleteThumbnail } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";
import {
	MediaRepository,
	DrizzleSourceRepository,
} from "~/infrastructure/db/repositories";
import { services } from "~/infrastructure/service-registry";
import { ccipVectorService } from "~/infrastructure/services/ccip-vector-service";
import { MediaProcessingService } from "~/infrastructure/services/media-processing-service";

const sourceRepo = DrizzleSourceRepository;

type SyncCounts = Pick<
	DirectorySyncResult,
	"sourceId" | "added" | "deleted" | "failed"
>;

type SourceSyncStatus = {
	message?: string;
	status: MediaSourceSyncState;
	updatedAt: Date;
};

const syncStateGlobal = globalThis as typeof globalThis & {
	__SOLID_IMAGER_SOURCE_SYNC_STATES__?: Map<string, SourceSyncStatus>;
};
const sourceSyncStates =
	syncStateGlobal.__SOLID_IMAGER_SOURCE_SYNC_STATES__ ??
	new Map<string, SourceSyncStatus>();
syncStateGlobal.__SOLID_IMAGER_SOURCE_SYNC_STATES__ = sourceSyncStates;
type MonitoringSyncScope = {
	basePath: string;
	isCurrent: () => boolean;
};
const activeSyncs = new Map<string, Promise<DirectorySyncResult>>();
const PublicDirectorySyncFailureMessage = "Directory sync failed";
const DirectorySyncConcurrencyLimit = 5;

function publishSyncStatus(
	mediaSourceId: string,
	status: MediaSourceSyncState,
	message?: string,
): void {
	const updatedAt = new Date();
	const state = { status, message, updatedAt } satisfies SourceSyncStatus;
	sourceSyncStates.set(mediaSourceId, state);
	RealtimeEventBus.publishSource(mediaSourceId, "source-sync-status", {
		mediaSourceId,
		status,
		message,
		timestamp: updatedAt.toISOString(),
	});
}

async function persistSyncStatus(
	mediaSourceId: string,
	status: MediaSourceSyncState,
	message?: string,
): Promise<void> {
	const now = new Date();
	await sourceRepo.update(mediaSourceId, {
		syncStatus: status,
		...(status === "syncing"
			? { lastSyncStartedAt: now, lastSyncError: null }
			: status === "idle"
				? { lastSyncCompletedAt: now, lastSyncError: null }
				: { lastSyncError: message ?? PublicDirectorySyncFailureMessage }),
	});
}

async function setSyncStatus(
	mediaSourceId: string,
	status: MediaSourceSyncState,
	message?: string,
): Promise<void> {
	await persistSyncStatus(mediaSourceId, status, message);
	try {
		publishSyncStatus(mediaSourceId, status, message);
	} catch (error) {
		// The database already committed. Notification delivery must not reverse it.
		logger.error(
			{ err: error, mediaSourceId, status },
			"Failed to publish source sync status",
		);
	}
}

async function finishSync(
	result: SyncCounts,
	error?: string,
): Promise<DirectorySyncResult> {
	const outcome: DirectorySyncResult = error
		? { ...result, failed: Math.max(1, result.failed), success: false, error }
		: { ...result, success: true };
	try {
		await setSyncStatus(
			result.sourceId,
			outcome.success ? "idle" : "error",
			error,
		);
	} catch (persistError) {
		// Keep the last committed state and emit no terminal event for an unsaved result.
		logger.error(
			{ err: persistError, mediaSourceId: result.sourceId },
			"Failed to persist directory sync result",
		);
		return {
			...result,
			failed: Math.max(1, result.failed),
			success: false,
			error: "Failed to persist directory sync result",
		};
	}
	return outcome;
}

export function getSourceSyncState(
	mediaSourceId: string,
): MediaSourceSyncState {
	return sourceSyncStates.get(mediaSourceId)?.status ?? "idle";
}

async function* scanFiles(basePath: string): AsyncGenerator<string> {
	const pendingDirectories = [""];

	while (pendingDirectories.length > 0) {
		const relativeDirectory = pendingDirectories.pop();
		if (relativeDirectory === undefined) {
			break;
		}

		const directoryPath = path.join(basePath, relativeDirectory);
		const directory = await fs.opendir(directoryPath);
		for await (const entry of directory) {
			if (entry.name.startsWith(".")) {
				continue;
			}

			const relativePath = path.join(relativeDirectory, entry.name);
			if (entry.isDirectory()) {
				pendingDirectories.push(relativePath);
			} else if (entry.isFile()) {
				yield relativePath.split(path.sep).join("/");
			}
		}
	}
}

async function processAdditions(
	mediaSourceId: string,
	filesToAdd: string[],
	result: SyncCounts,
): Promise<number> {
	let failures = 0;
	await Promise.all(
		filesToAdd.map(async (fileToAdd) => {
			try {
				await MediaProcessingService.registerAndProcess(
					mediaSourceId,
					fileToAdd,
				);
				result.added++;
			} catch (error) {
				logger.error(
					{ err: error, mediaSourceId, fileToAdd },
					"Failed to process new file during sync",
				);
				failures++;
				result.failed++;
			}
		}),
	);
	return failures;
}

async function processDeletions(
	mediaSourceId: string,
	filesToDelete: { id: string; relativePath: string }[],
	result: SyncCounts,
): Promise<number> {
	let failures = 0;
	await Promise.all(
		filesToDelete.map(async (fileToDelete) => {
			try {
				await MediaRepository.delete(fileToDelete.id);
				result.deleted++;
				try {
					await ccipVectorService.delete(fileToDelete.id);
				} catch (error) {
					logger.warn(
						{ err: error, mediaId: fileToDelete.id },
						"Failed to delete CCIP vector during directory sync",
					);
				}
				await deleteThumbnail(mediaSourceId, fileToDelete.id);
				RealtimeEventBus.publishSource(mediaSourceId, "media-deleted", {
					filePath: fileToDelete.relativePath,
					mediaId: fileToDelete.id,
					timestamp: new Date().toISOString(),
				});
			} catch (error) {
				logger.error(
					{ err: error, mediaSourceId, fileToDelete },
					"Failed to process deleted file during sync",
				);
				failures++;
				result.failed++;
			}
		}),
	);
	return failures;
}

/**
 * Service to sync media files between the file system and the database.
 * Designed to run on startup to catch files added or removed while the app was offline.
 */
export const DirectorySyncService = {
	/**
	 * Performs a comprehensive sync for a specific local media source.
	 */
	async syncMediaSource(
		mediaSourceId: string,
		monitoringScope?: MonitoringSyncScope,
	): Promise<DirectorySyncResult> {
		const superseded = (): DirectorySyncResult => ({
			sourceId: mediaSourceId,
			added: 0,
			deleted: 0,
			failed: 1,
			success: false,
			error: "Monitoring preparation was superseded",
		});
		if (monitoringScope && !monitoringScope.isCurrent()) return superseded();
		const activeSync = activeSyncs.get(mediaSourceId);
		if (activeSync) {
			// Direct RPC callers keep source-level sharing. A watcher must instead
			// prepare the exact path it will watch, after older-path work has finished.
			if (!monitoringScope) return activeSync;
			// Monitoring starts scanning only after its watcher is ready. An older
			// run (even on the same path) cannot cover that watcher's initial crawl
			// and may have skipped scanning after its own generation was invalidated.
			await activeSync;
			if (!monitoringScope.isCurrent()) return superseded();
			if (activeSyncs.get(mediaSourceId) === activeSync)
				activeSyncs.delete(mediaSourceId);
			return this.syncMediaSource(mediaSourceId, monitoringScope);
		}

		const syncPromise = (async (): Promise<DirectorySyncResult> => {
			const result: SyncCounts = {
				sourceId: mediaSourceId,
				added: 0,
				deleted: 0,
				failed: 0,
			};
			try {
				const source = await sourceRepo.findById(mediaSourceId);
				if (source?.type !== "local") {
					return {
						...result,
						failed: 1,
						success: false,
						error: source
							? "Source type does not support directory sync"
							: "Source not found",
					};
				}
				const basePath = localConnectionSchema.parse(
					source.connectionInfo,
				).path;
				if (
					monitoringScope &&
					(!monitoringScope.isCurrent() ||
						basePath !== monitoringScope.basePath)
				)
					return superseded();
				await setSyncStatus(mediaSourceId, "syncing");

				try {
					await fs.access(basePath);
				} catch {
					logger.error(
						{ mediaSourceId, basePath },
						"Base path does not exist or is not accessible during sync",
					);
					return finishSync(result, "Source path is not accessible");
				}

				logger.info(
					{ mediaSourceId, basePath },
					"Starting directory sync for source",
				);

				// 1. Get existing paths from DB
				const existingRecords =
					await MediaRepository.findAllPathsBySourceId(mediaSourceId);
				const dbPathMap = new Map<string, string>(); // relativePath -> id
				for (const record of existingRecords) {
					// Ensure path uses POSIX separators for uniform comparison
					const normalizedPath = record.filePath.split(path.sep).join("/");
					dbPathMap.set(normalizedPath, record.id);
				}

				const config = services.getConfigService().getConfig();
				const concurrency = Math.min(
					DirectorySyncConcurrencyLimit,
					Math.max(1, config.jobs.concurrency),
				);
				const allowedExts = new Set(
					Object.values(config.media.supportedExtensions)
						.flat()
						.map((ext) => ext.toLowerCase()),
				);

				// Await each small batch before reading more files. Registration reads
				// image/video metadata before enqueueing a job, outside JobWorker's pool.
				let failures = 0;
				let additions: string[] = [];
				for await (const relativePath of scanFiles(basePath)) {
					if (dbPathMap.delete(relativePath)) {
						continue;
					}
					if (!allowedExts.has(path.extname(relativePath).toLowerCase())) {
						continue;
					}
					additions.push(relativePath.split("/").join(path.sep));
					if (additions.length >= concurrency) {
						failures += await processAdditions(
							mediaSourceId,
							additions,
							result,
						);
						additions = [];
					}
				}
				failures += await processAdditions(mediaSourceId, additions, result);

				// Only delete after the entire scan succeeds. A failed/inaccessible
				// subtree must never make its existing media look like missing files.
				let deletions: { id: string; relativePath: string }[] = [];
				for (const [relativePath, id] of dbPathMap) {
					deletions.push({
						id,
						relativePath: relativePath.split("/").join(path.sep),
					});
					if (deletions.length >= concurrency) {
						failures += await processDeletions(
							mediaSourceId,
							deletions,
							result,
						);
						deletions = [];
					}
				}
				failures += await processDeletions(mediaSourceId, deletions, result);

				if (failures > 0) {
					logger.warn(
						{ mediaSourceId, failures, syncResult: result },
						"Directory sync partially failed",
					);
					return finishSync(result, PublicDirectorySyncFailureMessage);
				}
				logger.info(
					{ mediaSourceId, syncResult: result },
					"Directory sync completed successfully",
				);
				return finishSync(result);
			} catch (error) {
				logger.error(
					{ err: error, mediaSourceId },
					"Error during directory sync",
				);
				return finishSync(result, PublicDirectorySyncFailureMessage);
			}
		})();

		activeSyncs.set(mediaSourceId, syncPromise);
		try {
			return await syncPromise;
		} finally {
			if (activeSyncs.get(mediaSourceId) === syncPromise) {
				activeSyncs.delete(mediaSourceId);
			}
		}
	},

	/**
	 * Syncs all local media sources.
	 */
	async syncAllLocalSources(): Promise<DirectorySyncResult[]> {
		logger.info("Starting global directory sync for all local sources");
		const sources = await sourceRepo.findAll();
		const results: DirectorySyncResult[] = [];

		for (const source of sources) {
			if (source.type === "local") {
				const result = await this.syncMediaSource(source.id);
				results.push(result);
			}
		}

		logger.info("Global directory sync completed");
		return results;
	},
};
