import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { services } from "~/application/registry";
import { MediaProcessingService } from "~/application/services/media-processing-service";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { deleteThumbnail } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";

const sourceRepo = new DrizzleSourceRepository();

type SyncResult = {
	sourceId: string;
	added: number;
	deleted: number;
};

async function processAdditions(
	mediaSourceId: string,
	filesToAdd: string[],
	result: SyncResult,
): Promise<void> {
	logger.info({ mediaSourceId, count: filesToAdd.length }, "Sync: Found new files to add");
	await Promise.all(
		filesToAdd.map(async (fileToAdd) => {
			try {
				await MediaProcessingService.registerAndProcess(mediaSourceId, fileToAdd);
				result.added++;
			} catch (error) {
				logger.error(
					{ err: error, mediaSourceId, fileToAdd },
					"Failed to process new file during sync",
				);
			}
		}),
	);
}

async function processDeletions(
	mediaSourceId: string,
	filesToDelete: { id: string; relativePath: string }[],
	result: SyncResult,
): Promise<void> {
	logger.info(
		{ mediaSourceId, count: filesToDelete.length },
		"Sync: Found missing files to delete",
	);
	if (filesToDelete.length === 0) {
		return;
	}
	await Promise.all(
		filesToDelete.map(async (fileToDelete) => {
			try {
				await MediaRepository.delete(fileToDelete.id);
				await deleteThumbnail(mediaSourceId, fileToDelete.id);
				SseManager.sendEvent(mediaSourceId, "media-deleted", {
					filePath: fileToDelete.relativePath,
					timestamp: new Date().toISOString(),
				});
				result.deleted++;
			} catch (error) {
				logger.error(
					{ err: error, mediaSourceId, fileToDelete },
					"Failed to process deleted file during sync",
				);
			}
		}),
	);
}

/**
 * Service to sync media files between the file system and the database.
 * Designed to run on startup to catch files added or removed while the app was offline.
 */
export const DirectorySyncService = {
	/**
	 * Performs a comprehensive sync for a specific local media source.
	 */
	async syncMediaSource(mediaSourceId: string): Promise<SyncResult> {
		const result: SyncResult = {
			sourceId: mediaSourceId,
			added: 0,
			deleted: 0,
		};
		try {
			const source = await sourceRepo.findById(mediaSourceId);
			if (!source || source.type !== "local") {
				logger.info({ mediaSourceId }, "Skipping sync for non-local or missing source");
				return result;
			}

			const basePath = (source.connectionInfo as { path: string }).path;

			try {
				await fs.access(basePath);
			} catch {
				logger.error(
					{ mediaSourceId, basePath },
					"Base path does not exist or is not accessible during sync",
				);
				return result;
			}

			logger.info({ mediaSourceId, basePath }, "Starting directory sync for source");

			// 1. Get existing paths from DB
			const existingRecords = await MediaRepository.findAllPathsBySourceId(mediaSourceId);
			const dbPathMap = new Map<string, string>(); // relativePath -> id
			for (const record of existingRecords) {
				// Ensure path uses POSIX separators for uniform comparison
				const normalizedPath = record.filePath.split(path.sep).join("/");
				dbPathMap.set(normalizedPath, record.id);
			}

			// 2. Scan actual file system
			// fast-glob uses POSIX separators even on Windows
			const fsPaths = await fg("**/*", {
				cwd: basePath,
				ignore: ["**/.*", "**/.*/**"], // Ignore dotfiles and dot directories
				onlyFiles: true,
				caseSensitiveMatch: false,
			});

			const mediaExtensions = services.getConfigService().getConfig().media.supportedExtensions;
			const allowedExts = new Set(
				Object.values(mediaExtensions)
					.flat()
					.map((ext) => ext.toLowerCase()),
			);

			const actualMediaPaths = fsPaths.filter((p) => {
				const ext = path.extname(p).toLowerCase();
				return allowedExts.has(ext);
			});
			const allFilesPathSet = new Set(fsPaths);

			// 3. Calculate diffs
			const filesToAdd: string[] = [];
			for (const p of actualMediaPaths) {
				if (!dbPathMap.has(p)) {
					filesToAdd.push(p.split("/").join(path.sep));
				}
			}

			const filesToDelete: { id: string; relativePath: string }[] = [];
			for (const [p, id] of dbPathMap.entries()) {
				if (!allFilesPathSet.has(p)) {
					filesToDelete.push({ id, relativePath: p.split("/").join(path.sep) });
				}
			}

			// 4. Batch process additions
			await processAdditions(mediaSourceId, filesToAdd, result);

			// 5. Batch process deletions
			await processDeletions(mediaSourceId, filesToDelete, result);

			logger.info({ mediaSourceId, syncResult: result }, "Directory sync completed successfully");
			return result;
		} catch (error) {
			logger.error({ err: error, mediaSourceId }, "Error during directory sync");
			return result;
		}
	},

	/**
	 * Syncs all local media sources.
	 */
	async syncAllLocalSources(): Promise<SyncResult[]> {
		logger.info("Starting global directory sync for all local sources");
		const sources = await sourceRepo.findAll();
		const results: SyncResult[] = [];

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
