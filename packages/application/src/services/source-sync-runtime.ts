import {
	inferMediaType,
	type SupportedExtensions,
} from "@solid-imager/core/domain/media/utils/media-type-utils";
import {
	isHiddenPath,
	normalizeRelativePath,
} from "@solid-imager/core/domain/media/utils/path-utils";
import type { MediaSource } from "@solid-imager/core/domain/repositories/source-repository";
import type { MediaSourceEventPublisher } from "./runtime-events";
import { createTimestamp } from "./runtime-events";
import { deleteWatchedDirectory, deleteWatchedFile } from "./watcher-runtime";

export type SourceSyncProbeResult = {
	width: number;
	height: number;
	size: number;
	createdAt: string | Date;
	modifiedAt: string | Date;
	duration?: number | null;
	mimeType?: string | null;
	codec?: string | null;
};

export type SourceSyncMediaType = "image" | "video" | "audio";

export type SourceSyncUpsertInput = {
	mediaSourceId: string;
	filePath: string;
	fileName: string;
	mediaType: SourceSyncMediaType;
	width: number;
	height: number;
	fileSize: number;
	description: string | null;
	createdAt: Date;
	modifiedAt: Date;
};

export type SourceSyncMediaRecord = {
	id: string;
	filePath: string;
	fileSize: number | null;
	modifiedAt: Date | null;
};

export type SourceSyncResult = {
	id: string;
	success: boolean;
	added: number;
	deleted: number;
	error?: string;
};

export type SourceWatchEventPayload = {
	mediaSourceId: string;
	paths: string[];
	timestamp?: string;
};

type FileSystemEntryStat = {
	isDirectory: boolean;
};

type FileToIndex = {
	fullPath: string;
	relativePath: string;
	normalizedRelPath: string;
	mediaType: SourceSyncMediaType;
};

export type SourceSyncScanEntry = {
	fullPath: string;
	isDirectory: boolean;
};

export type SourceSyncBatchProbeItem = {
	mediaPath: string;
	result: SourceSyncProbeResult | null;
	error: string | null;
};

export type SourceSyncRuntimeDeps = {
	resolveSourceRootPath(
		source: Pick<MediaSource, "type" | "connectionInfo">,
	): string;
	toRelativePath(rootPath: string, fullPath: string): string;
	joinPath(rootPath: string, relativePath: string): string;
	basename(path: string): string;
	fileSystem: {
		exists(path: string): Promise<boolean>;
		stat(path: string): Promise<FileSystemEntryStat>;
		readdir(path: string): Promise<string[]>;
		scanDirectoryRecursive?(path: string): Promise<SourceSyncScanEntry[]>;
	};
	config: {
		getSupportedExtensions():
			| Promise<SupportedExtensions>
			| SupportedExtensions;
		getProbeConcurrency(): Promise<number> | number;
	};
	probeMedia(fullPath: string): Promise<SourceSyncProbeResult>;
	batchProbeMedia?(paths: string[]): Promise<SourceSyncBatchProbeItem[]>;
	mediaRepository: {
		findByPath(
			mediaSourceId: string,
			relativePath: string,
		): Promise<SourceSyncMediaRecord | null>;
		findAllPathsBySourceId(sourceId: string): Promise<SourceSyncMediaRecord[]>;
		batchUpsert(
			inputs: SourceSyncUpsertInput[],
		): Promise<SourceSyncMediaRecord[]>;
		delete(mediaId: string): Promise<void>;
		deleteByPathPrefix(
			mediaSourceId: string,
			relativePath: string,
		): Promise<SourceSyncMediaRecord[]>;
	};
	enqueueProcessMediaJobs(
		jobs: Array<{ sourceId: string; mediaId: string; sourcePath: string }>,
	): Promise<void>;
	events: Pick<
		MediaSourceEventPublisher,
		"mediaAdded" | "mediaChanged" | "mediaDeleted"
	>;
	logger?: {
		debug(message: string, meta?: Record<string, unknown>): void;
		error(message: string, error?: unknown): void;
	};
	retry?: {
		delayMs?: number;
		maxAttempts?: number;
		sleep?(ms: number): Promise<void>;
	};
	batchSize?: number;
};

const DEFAULT_BATCH_SIZE = 500;
const DEFAULT_RETRY_DELAY_MS = 500;
const DEFAULT_MAX_RETRIES = 5;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripTrailingSeparators(path: string): string {
	return path.replace(/[\\/]+$/, "");
}

export function parseSourceWatchEventPayload(
	payload: unknown,
): SourceWatchEventPayload | null {
	if (typeof payload !== "object" || payload === null) {
		return null;
	}

	const value = payload as Record<string, unknown>;
	const mediaSourceId =
		typeof value.mediaSourceId === "string" ? value.mediaSourceId : undefined;
	const paths = Array.isArray(value.paths)
		? value.paths.filter((path): path is string => typeof path === "string")
		: [];

	if (!mediaSourceId || paths.length === 0) {
		return null;
	}

	return {
		mediaSourceId,
		paths,
		timestamp:
			typeof value.timestamp === "string" ? value.timestamp : undefined,
	};
}

export function createSourceSyncRuntime(deps: SourceSyncRuntimeDeps) {
	const pendingWatchPaths = new Set<string>();
	const batchSize = deps.batchSize ?? DEFAULT_BATCH_SIZE;
	const retryDelayMs = deps.retry?.delayMs ?? DEFAULT_RETRY_DELAY_MS;
	const maxRetries = deps.retry?.maxAttempts ?? DEFAULT_MAX_RETRIES;
	const sleepForRetry = deps.retry?.sleep ?? sleep;

	async function scanDirectoryRecursive(rootPath: string): Promise<string[]> {
		if (deps.fileSystem.scanDirectoryRecursive) {
			const entries = await deps.fileSystem.scanDirectoryRecursive(rootPath);
			return entries
				.filter((entry) => !entry.isDirectory)
				.map((entry) => entry.fullPath);
		}

		const entries = await deps.fileSystem.readdir(rootPath);
		const files: string[] = [];

		for (const entry of entries) {
			if (entry.startsWith(".")) {
				continue;
			}
			const fullPath = deps.joinPath(rootPath, entry);
			const stat = await deps.fileSystem.stat(fullPath);
			if (stat.isDirectory) {
				files.push(...(await scanDirectoryRecursive(fullPath)));
				continue;
			}
			files.push(fullPath);
		}

		return files;
	}

	function buildSingleFileIndexInput(
		source: MediaSource,
		fullPath: string,
		supportedExtensions: SupportedExtensions,
	): FileToIndex | null {
		const rootPath = deps.resolveSourceRootPath(source);
		const relativePath = deps.toRelativePath(rootPath, fullPath);
		if (!relativePath || isHiddenPath(relativePath)) {
			return null;
		}

		const mediaType = inferMediaType(relativePath, supportedExtensions);
		if (!mediaType) {
			return null;
		}

		return {
			fullPath,
			relativePath,
			normalizedRelPath: normalizeRelativePath(relativePath),
			mediaType,
		};
	}

	async function probeAndCollect(
		sourceId: string,
		files: FileToIndex[],
	): Promise<Array<SourceSyncUpsertInput & { normalizedRelPath: string }>> {
		if (deps.batchProbeMedia) {
			return probeAndCollectBatch(sourceId, files);
		}
		return probeAndCollectSequential(sourceId, files);
	}

	async function probeAndCollectBatch(
		sourceId: string,
		files: FileToIndex[],
	): Promise<Array<SourceSyncUpsertInput & { normalizedRelPath: string }>> {
		const paths = files.map((f) => f.fullPath);
		const fileMap = new Map(files.map((f) => [f.fullPath, f]));
		const batchResults = await deps.batchProbeMedia?.(paths);
		const results: Array<
			SourceSyncUpsertInput & { normalizedRelPath: string }
		> = [];

		for (const item of batchResults) {
			if (item.error || !item.result) {
				deps.logger?.error("[sync] probe failed", item.error);
				continue;
			}
			const file = fileMap.get(item.mediaPath);
			if (!file) {
				continue;
			}
			results.push({
				mediaSourceId: sourceId,
				filePath: file.relativePath,
				fileName: deps.basename(item.mediaPath),
				mediaType: file.mediaType,
				width: item.result.width,
				height: item.result.height,
				fileSize: item.result.size,
				description: null,
				createdAt: new Date(item.result.createdAt),
				modifiedAt: new Date(item.result.modifiedAt),
				normalizedRelPath: file.normalizedRelPath,
			});
		}

		return results;
	}

	async function probeAndCollectSequential(
		sourceId: string,
		files: FileToIndex[],
	): Promise<Array<SourceSyncUpsertInput & { normalizedRelPath: string }>> {
		const results: Array<
			SourceSyncUpsertInput & { normalizedRelPath: string }
		> = [];
		const configuredConcurrency = await deps.config.getProbeConcurrency();
		const concurrency = Math.max(1, configuredConcurrency);

		for (let i = 0; i < files.length; i += concurrency) {
			const chunk = files.slice(i, i + concurrency);
			const settled = await Promise.allSettled(
				chunk.map(
					async ({ fullPath, relativePath, normalizedRelPath, mediaType }) => {
						const probe = await deps.probeMedia(fullPath);
						return {
							mediaSourceId: sourceId,
							filePath: relativePath,
							fileName: deps.basename(fullPath),
							mediaType,
							width: probe.width,
							height: probe.height,
							fileSize: probe.size,
							description: null,
							createdAt: new Date(probe.createdAt),
							modifiedAt: new Date(probe.modifiedAt),
							normalizedRelPath,
						};
					},
				),
			);

			for (const result of settled) {
				if (result.status === "rejected") {
					deps.logger?.error("[sync] probe failed", result.reason);
				} else {
					results.push(result.value);
				}
			}
		}

		return results;
	}

	async function upsertIndexedFile(
		source: MediaSource,
		file: FileToIndex,
	): Promise<{ mediaId: string; isNew: boolean } | null> {
		const rootPath = deps.resolveSourceRootPath(source);
		const existing = await deps.mediaRepository.findByPath(
			source.id,
			file.normalizedRelPath,
		);
		const probed = await probeAndCollect(source.id, [file]);
		if (probed.length === 0) {
			return null;
		}

		const [{ normalizedRelPath, ...input }] = probed;
		const [row] = await deps.mediaRepository.batchUpsert([input]);
		if (!row) {
			return null;
		}

		const payload = {
			mediaSourceId: source.id,
			mediaId: row.id,
			filePath: normalizedRelPath,
			timestamp: createTimestamp(),
		};
		if (existing) {
			await deps.events.mediaChanged(payload);
		} else {
			await deps.events.mediaAdded(payload);
		}

		await deps.enqueueProcessMediaJobs([
			{
				sourceId: source.id,
				mediaId: row.id,
				sourcePath: rootPath,
			},
		]);

		return { mediaId: row.id, isNew: !existing };
	}

	async function upsertIndexedFileWithRetry(
		source: MediaSource,
		file: FileToIndex,
	): Promise<{ mediaId: string; isNew: boolean } | null> {
		for (let attempt = 0; attempt < maxRetries; attempt += 1) {
			const result = await upsertIndexedFile(source, file);
			if (result) {
				return result;
			}

			if (attempt + 1 < maxRetries) {
				await sleepForRetry(retryDelayMs);
			}
		}

		return null;
	}

	async function deleteIndexedDirectory(
		source: MediaSource,
		relativePath: string,
	): Promise<number> {
		const normalizedRelPath = stripTrailingSeparators(
			normalizeRelativePath(relativePath),
		);
		if (!normalizedRelPath) {
			return 0;
		}

		return await deleteWatchedDirectory(source.id, normalizedRelPath, {
			deleteByPathPrefix: deps.mediaRepository.deleteByPathPrefix,
			events: deps.events,
		});
	}

	return {
		parseSourceWatchEventPayload,

		async syncLocalSource(source: MediaSource): Promise<SourceSyncResult> {
			const rootPath = deps.resolveSourceRootPath(source);
			if (!(await deps.fileSystem.exists(rootPath))) {
				throw new Error(`Source path does not exist: ${rootPath}`);
			}

			const supportedExtensions = await deps.config.getSupportedExtensions();
			const existingRecords = await deps.mediaRepository.findAllPathsBySourceId(
				source.id,
			);
			const dbPathMap = new Map(
				existingRecords.map((record) => [
					normalizeRelativePath(record.filePath),
					record.id,
				]),
			);
			const preSyncSnapshot = new Map(
				existingRecords.map((record) => [
					normalizeRelativePath(record.filePath),
					{
						id: record.id,
						fileSize: record.fileSize,
						modifiedAt: record.modifiedAt,
					},
				]),
			);

			const scannedFiles = await scanDirectoryRecursive(rootPath);
			deps.logger?.debug("[sync] scanned files", {
				sourceId: source.id,
				count: scannedFiles.length,
			});

			const filesToIndex: FileToIndex[] = [];
			for (const fullPath of scannedFiles) {
				const file = buildSingleFileIndexInput(
					source,
					fullPath,
					supportedExtensions,
				);
				if (file) {
					filesToIndex.push(file);
				}
			}
			deps.logger?.debug("[sync] media files", {
				sourceId: source.id,
				count: filesToIndex.length,
			});

			const actualMediaPaths = new Set(
				filesToIndex.map((file) => file.normalizedRelPath),
			);
			let added = 0;
			const batch: SourceSyncUpsertInput[] = [];
			const allReturned: Array<{ id: string; normalizedRelPath: string }> = [];

			const flushBatch = async () => {
				if (batch.length === 0) {
					return;
				}
				const toInsert = batch.splice(0);
				const returned = await deps.mediaRepository.batchUpsert(toInsert);
				for (const row of returned) {
					allReturned.push({
						id: row.id,
						normalizedRelPath: normalizeRelativePath(row.filePath),
					});
				}
			};

			const probed = await probeAndCollect(source.id, filesToIndex);
			const probedDataMap = new Map(
				probed.map((item) => [item.normalizedRelPath, item]),
			);
			for (const { normalizedRelPath, ...input } of probed) {
				if (!dbPathMap.has(normalizedRelPath)) {
					added += 1;
				}
				batch.push(input);
				if (batch.length >= batchSize) {
					await flushBatch();
				}
			}
			await flushBatch();

			const newMediaJobs: Array<{
				sourceId: string;
				mediaId: string;
				sourcePath: string;
			}> = [];
			const now = createTimestamp();
			for (const { id, normalizedRelPath } of allReturned) {
				if (!dbPathMap.has(normalizedRelPath)) {
					await deps.events.mediaAdded({
						mediaSourceId: source.id,
						mediaId: id,
						filePath: normalizedRelPath,
						timestamp: now,
					});
					newMediaJobs.push({
						sourceId: source.id,
						mediaId: id,
						sourcePath: rootPath,
					});
				}
			}

			if (newMediaJobs.length > 0) {
				await deps.enqueueProcessMediaJobs(newMediaJobs);
				deps.logger?.debug("[sync] enqueued media processing jobs", {
					sourceId: source.id,
					count: newMediaJobs.length,
				});
			}

			const changedMediaJobs: Array<{
				sourceId: string;
				mediaId: string;
				sourcePath: string;
			}> = [];
			for (const [normalizedRelPath, probedItem] of probedDataMap) {
				const preSync = preSyncSnapshot.get(normalizedRelPath);
				if (!preSync) continue;
				if (
					preSync.fileSize !== probedItem.fileSize ||
					Math.floor((preSync.modifiedAt?.getTime() ?? 0) / 1000) !==
						Math.floor((probedItem.modifiedAt?.getTime() ?? 0) / 1000)
				) {
					await deps.events.mediaChanged({
						mediaSourceId: source.id,
						mediaId: preSync.id,
						filePath: normalizedRelPath,
						timestamp: now,
					});
					changedMediaJobs.push({
						sourceId: source.id,
						mediaId: preSync.id,
						sourcePath: rootPath,
					});
				}
			}

			if (changedMediaJobs.length > 0) {
				await deps.enqueueProcessMediaJobs(changedMediaJobs);
				deps.logger?.debug(
					"[sync] enqueued media processing jobs for changed files",
					{
						sourceId: source.id,
						count: changedMediaJobs.length,
					},
				);
			}

			let deleted = 0;
			for (const [relativePath, mediaId] of dbPathMap.entries()) {
				if (actualMediaPaths.has(relativePath)) {
					continue;
				}
				const wasDeleted = await deleteWatchedFile(source.id, relativePath, {
					findByPath: deps.mediaRepository.findByPath,
					deleteMedia: deps.mediaRepository.delete,
					events: deps.events,
					existing: {
						id: mediaId,
						filePath: relativePath,
					},
				});
				if (wasDeleted) {
					deleted += 1;
				}
			}

			deps.logger?.debug("[sync] completed", {
				sourceId: source.id,
				added,
				deleted,
			});
			return { id: source.id, success: true, added, deleted };
		},

		async reconcileWatchedPath(
			source: MediaSource,
			fullPath: string,
		): Promise<void> {
			const dedupeKey = `${source.id}:${normalizeRelativePath(fullPath)}`;
			if (pendingWatchPaths.has(dedupeKey)) {
				return;
			}
			pendingWatchPaths.add(dedupeKey);

			try {
				const supportedExtensions = await deps.config.getSupportedExtensions();
				const exists = await deps.fileSystem.exists(fullPath);
				if (exists) {
					const stat = await deps.fileSystem.stat(fullPath);
					if (stat.isDirectory) {
						const nestedFiles = await scanDirectoryRecursive(fullPath);
						for (const nestedPath of nestedFiles) {
							const file = buildSingleFileIndexInput(
								source,
								nestedPath,
								supportedExtensions,
							);
							if (!file) {
								continue;
							}
							await upsertIndexedFileWithRetry(source, file);
						}
						return;
					}

					const file = buildSingleFileIndexInput(
						source,
						fullPath,
						supportedExtensions,
					);
					if (!file) {
						return;
					}
					await upsertIndexedFileWithRetry(source, file);
					return;
				}

				const rootPath = deps.resolveSourceRootPath(source);
				const relativePath = deps.toRelativePath(rootPath, fullPath);
				if (!relativePath || isHiddenPath(relativePath)) {
					return;
				}
				const existing = await deps.mediaRepository.findByPath(
					source.id,
					relativePath,
				);
				if (existing) {
					await deleteWatchedFile(source.id, relativePath, {
						findByPath: deps.mediaRepository.findByPath,
						deleteMedia: deps.mediaRepository.delete,
						events: deps.events,
						existing,
					});
					return;
				}
				await deleteIndexedDirectory(source, relativePath);
			} finally {
				pendingWatchPaths.delete(dedupeKey);
			}
		},
	};
}
