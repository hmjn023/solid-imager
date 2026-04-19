import type {
	MediaSource,
	NewMediaSource,
} from "@solid-imager/core/domain/repositories/source-repository";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { emit, listen } from "@tauri-apps/api/event";
import { getTauriAppServices } from "~/app-services";
import { tauriJobQueue } from "../../jobs/tauri-job-queue";
import type { ThumbnailJob } from "../../jobs/thumbnail-job";
import { basename, extname, joinLocalPath } from "../../path-utils";
import { TauriMediaRepository } from "../repositories/media-repository";
import { TauriSourceRepository } from "../repositories/source-repository";
import { TauriConfigService } from "./config-service";

type ProbeMediaResult = {
	width: number;
	height: number;
	size: number;
	createdAt: string;
	modifiedAt: string;
	duration?: number | null;
	mimeType?: string | null;
	codec?: string | null;
};

type SyncResult = {
	id: string;
	success: boolean;
	added: number;
	deleted: number;
	error?: string;
};

const sourceWatchers = new Map<string, true>();
const pendingWatchPaths = new Set<string>();
const WATCH_RETRY_DELAY_MS = 500;
const WATCH_MAX_RETRIES = 5;
const WATCH_START_RETRY_DELAY_MS = 5_000;
const watchRetryTimers = new Map<string, ReturnType<typeof setTimeout>>();
let sourceWatchListenerReady: Promise<void> | null = null;

type SourceWatchEventPayload = {
	mediaSourceId: string;
	paths: string[];
	timestamp?: string;
};

function toSafeMediaSource(source: MediaSource): SafeMediaSource {
	if (source.type === "sftp") {
		const info = source.connectionInfo as {
			host: string;
			port: number;
			username: string;
			remotePath: string;
		};
		return {
			...source,
			connectionInfo: {
				host: info.host,
				port: info.port,
				username: info.username,
				remotePath: info.remotePath,
			},
		};
	}

	if (source.type === "s3") {
		const info = source.connectionInfo as {
			bucket: string;
			region: string;
			prefix?: string;
		};
		return {
			...source,
			connectionInfo: {
				bucket: info.bucket,
				region: info.region,
				prefix: info.prefix,
			},
		};
	}

	return source as SafeMediaSource;
}

function inferMediaType(
	filePath: string,
	supportedExtensions: {
		image: string[];
		video: string[];
		audio: string[];
	},
): "image" | "video" | "audio" | null {
	const normalizedExt = extname(filePath).toLowerCase();
	if (supportedExtensions.image.includes(normalizedExt)) return "image";
	if (supportedExtensions.video.includes(normalizedExt)) return "video";
	if (supportedExtensions.audio.includes(normalizedExt)) return "audio";
	return null;
}

function normalizeRelativePath(path: string) {
	return path.replace(/[\\/]+/g, "/");
}

function hasHiddenSegment(path: string) {
	return path
		.split(/[\\/]/)
		.filter(Boolean)
		.some((segment) => segment.startsWith("."));
}

async function scanDirectoryRecursive(rootPath: string): Promise<string[]> {
	const fs = getTauriAppServices().fileSystem;
	const entries = await fs.readdir(rootPath);
	const files: string[] = [];

	for (const entry of entries) {
		if (entry.startsWith(".")) {
			continue;
		}
		const fullPath = joinLocalPath(rootPath, entry);
		const stat = await fs.stat(fullPath);
		if (stat.isDirectory) {
			files.push(...(await scanDirectoryRecursive(fullPath)));
			continue;
		}
		files.push(fullPath);
	}

	return files;
}

function toRelativePath(rootPath: string, fullPath: string) {
	const normalizedRoot = rootPath.replace(/[\\/]+$/, "");
	const rootWithSep = `${normalizedRoot}${normalizedRoot.includes("\\") ? "\\" : "/"}`;
	if (fullPath.startsWith(rootWithSep)) {
		return normalizeRelativePath(fullPath.slice(rootWithSep.length));
	}
	if (fullPath === normalizedRoot) {
		return "";
	}
	return normalizeRelativePath(fullPath.replace(normalizedRoot, "").replace(/^[\\/]+/, ""));
}

function buildSingleFileIndexInput(
	source: MediaSource,
	fullPath: string,
	supportedExtensions: {
		image: string[];
		video: string[];
		audio: string[];
	},
): FileToIndex | null {
	const relativePath = toRelativePath((source.connectionInfo as { path: string }).path, fullPath);
	if (!relativePath || hasHiddenSegment(relativePath)) {
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

const INSERT_BATCH_SIZE = 500;

type FileToIndex = {
	fullPath: string;
	relativePath: string;
	normalizedRelPath: string;
	mediaType: "image" | "video" | "audio";
};

async function probeAndCollect(
	sourceId: string,
	files: FileToIndex[],
): Promise<
	Array<
		import("../repositories/media-repository").UpsertTauriMediaInput & {
			normalizedRelPath: string;
		}
	>
> {
	const results: Array<
		import("../repositories/media-repository").UpsertTauriMediaInput & {
			normalizedRelPath: string;
		}
	> = [];
	const commandClient = getTauriAppServices().commandClient;
	const concurrency = Math.max(1, (await TauriConfigService.getConfig()).jobs.concurrency);

	for (let i = 0; i < files.length; i += concurrency) {
		const chunk = files.slice(i, i + concurrency);
		const settled = await Promise.allSettled(
			chunk.map(async ({ fullPath, relativePath, normalizedRelPath, mediaType }) => {
				const probe = await commandClient.invoke<ProbeMediaResult>("probe_media", {
					mediaPath: fullPath,
				});
				return {
					mediaSourceId: sourceId,
					filePath: relativePath,
					fileName: basename(fullPath),
					mediaType,
					width: probe.width,
					height: probe.height,
					fileSize: probe.size,
					description: null as string | null,
					createdAt: new Date(probe.createdAt),
					modifiedAt: new Date(probe.modifiedAt),
					normalizedRelPath,
				};
			}),
		);

		for (const result of settled) {
			if (result.status === "rejected") {
				console.error("[sync] probe failed:", result.reason);
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
	const existing = await TauriMediaRepository.findByPath(source.id, file.normalizedRelPath);
	const probed = await probeAndCollect(source.id, [file]);
	if (probed.length === 0) {
		return null;
	}

	const [{ normalizedRelPath, ...input }] = probed;
	const [row] = await TauriMediaRepository.batchUpsert([input]);
	if (!row) {
		return null;
	}

	const payload = {
		mediaSourceId: source.id,
		mediaId: row.id,
		filePath: normalizedRelPath,
		timestamp: new Date().toISOString(),
	};
	if (existing) {
		await emit("media-changed", payload);
	} else {
		await emit("media-added", payload);
	}

	await tauriJobQueue.enqueue([
		{
			sourceId: source.id,
			mediaId: row.id,
			filePath: normalizedRelPath,
			fullPath: file.fullPath,
		},
	]);

	return { mediaId: row.id, isNew: !existing };
}

async function upsertIndexedFileWithRetry(
	source: MediaSource,
	file: FileToIndex,
): Promise<{ mediaId: string; isNew: boolean } | null> {
	for (let attempt = 0; attempt < WATCH_MAX_RETRIES; attempt += 1) {
		const result = await upsertIndexedFile(source, file);
		if (result) {
			return result;
		}

		if (attempt + 1 < WATCH_MAX_RETRIES) {
			await new Promise((resolve) => setTimeout(resolve, WATCH_RETRY_DELAY_MS));
		}
	}

	return null;
}

async function deleteIndexedFile(source: MediaSource, relativePath: string): Promise<boolean> {
	const normalizedRelPath = normalizeRelativePath(relativePath);
	const existing = await TauriMediaRepository.findByPath(source.id, normalizedRelPath);
	if (!existing) {
		return false;
	}

	await TauriMediaRepository.delete(existing.id);
	await emit("media-deleted", {
		mediaSourceId: source.id,
		mediaId: existing.id,
		filePath: existing.filePath,
		timestamp: new Date().toISOString(),
	});
	return true;
}

async function deleteIndexedDirectory(source: MediaSource, relativePath: string): Promise<void> {
	const normalizedRelPath = normalizeRelativePath(relativePath).replace(/[\\/]+$/, "");
	if (!normalizedRelPath) {
		return;
	}

	const deletedRecords = await TauriMediaRepository.deleteBySourceIdAndPathPrefix(
		source.id,
		normalizedRelPath,
	);
	for (const record of deletedRecords) {
		await emit("media-deleted", {
			mediaSourceId: source.id,
			mediaId: record.id,
			filePath: record.filePath,
			timestamp: new Date().toISOString(),
		});
	}
}

async function reconcileWatchedPath(source: MediaSource, fullPath: string): Promise<void> {
	const dedupeKey = `${source.id}:${normalizeRelativePath(fullPath)}`;
	if (pendingWatchPaths.has(dedupeKey)) {
		return;
	}
	pendingWatchPaths.add(dedupeKey);

	try {
		const config = await TauriConfigService.getConfig();
		const fs = getTauriAppServices().fileSystem;
		const exists = await fs.exists(fullPath);
		if (exists) {
			const stat = await fs.stat(fullPath);
			if (stat.isDirectory) {
				const nestedFiles = await scanDirectoryRecursive(fullPath);
				for (const nestedPath of nestedFiles) {
					const file = buildSingleFileIndexInput(
						source,
						nestedPath,
						config.media.supportedExtensions,
					);
					if (!file) {
						continue;
					}
					await upsertIndexedFileWithRetry(source, file);
				}
				return;
			}

			const file = buildSingleFileIndexInput(source, fullPath, config.media.supportedExtensions);
			if (!file) {
				return;
			}
			await upsertIndexedFileWithRetry(source, file);
			return;
		}

		const relativePath = toRelativePath((source.connectionInfo as { path: string }).path, fullPath);
		if (!relativePath || hasHiddenSegment(relativePath)) {
			return;
		}
		const existing = await TauriMediaRepository.findByPath(source.id, relativePath);
		if (existing) {
			await deleteIndexedFile(source, relativePath);
			return;
		}
		await deleteIndexedDirectory(source, relativePath);
	} finally {
		pendingWatchPaths.delete(dedupeKey);
	}
}

function parseSourceWatchEventPayload(payload: unknown): SourceWatchEventPayload | null {
	if (typeof payload !== "object" || payload === null) {
		return null;
	}

	const value = payload as Record<string, unknown>;
	const mediaSourceId = typeof value.mediaSourceId === "string" ? value.mediaSourceId : undefined;
	const paths = Array.isArray(value.paths)
		? value.paths.filter((path): path is string => typeof path === "string")
		: [];

	if (!mediaSourceId || paths.length === 0) {
		return null;
	}

	return {
		mediaSourceId,
		paths,
		timestamp: typeof value.timestamp === "string" ? value.timestamp : undefined,
	};
}

async function ensureSourceWatchListener(): Promise<void> {
	if (sourceWatchListenerReady) {
		return sourceWatchListenerReady;
	}

	sourceWatchListenerReady = (async () => {
		await listen("source-watch-event", (event) => {
			const payload = parseSourceWatchEventPayload(event.payload);
			if (!payload) {
				return;
			}

			void (async () => {
				const source = await TauriSourceRepository.findById(payload.mediaSourceId);
				if (!source || source.type !== "local") {
					return;
				}

				for (const path of payload.paths) {
					await reconcileWatchedPath(source, path).catch(async (error) => {
						console.error("[watcher] failed to reconcile path", error);
						await emit("watcher-error", {
							mediaSourceId: source.id,
							error: error instanceof Error ? error.message : String(error),
						});
					});
				}
			})().catch(async (error) => {
				console.error("[watcher] failed to process source watch event", error);
			});
		});
	})().catch((error) => {
		sourceWatchListenerReady = null;
		throw error;
	});

	return sourceWatchListenerReady;
}

async function stopSourceWatcher(sourceId: string): Promise<void> {
	const retryTimer = watchRetryTimers.get(sourceId);
	if (retryTimer) {
		clearTimeout(retryTimer);
		watchRetryTimers.delete(sourceId);
	}

	sourceWatchers.delete(sourceId);
	await getTauriAppServices().commandClient.invoke("source_watch_stop", {
		mediaSourceId: sourceId,
	});
}

async function startSourceWatcher(source: MediaSource): Promise<void> {
	if (source.type !== "local") {
		return;
	}

	const rootPath = (source.connectionInfo as { path: string }).path;
	await stopSourceWatcher(source.id);
	await getTauriAppServices().commandClient.invoke("source_watch_start", {
		mediaSourceId: source.id,
		watchPath: rootPath,
	});
	sourceWatchers.set(source.id, true);
}

async function startSourceWatcherSafely(source: MediaSource): Promise<void> {
	try {
		await ensureSourceWatchListener();
		await startSourceWatcher(source);
	} catch (error) {
		console.error("[watcher] failed to start", source.id, error);
		await emit("watcher-error", {
			mediaSourceId: source.id,
			error: error instanceof Error ? error.message : String(error),
		});

		if (!watchRetryTimers.has(source.id)) {
			const retryTimer = setTimeout(() => {
				watchRetryTimers.delete(source.id);
				void startSourceWatcherSafely(source);
			}, WATCH_START_RETRY_DELAY_MS);
			watchRetryTimers.set(source.id, retryTimer);
		}
	}
}

async function syncLocalSource(source: MediaSource): Promise<SyncResult> {
	const rootPath = (source.connectionInfo as { path: string }).path;
	const fs = getTauriAppServices().fileSystem;
	const exists = await fs.exists(rootPath);

	if (!exists) {
		throw new Error(`Source path does not exist: ${rootPath}`);
	}

	const config = await TauriConfigService.getConfig();
	const existingRecords = await TauriMediaRepository.findAllPathsBySourceId(source.id);
	const dbPathMap = new Map(
		existingRecords.map((record) => [normalizeRelativePath(record.filePath), record.id]),
	);

	const scannedFiles = await scanDirectoryRecursive(rootPath);
	console.debug(`[sync] source=${source.id} scannedFiles=${scannedFiles.length}`);

	// Filter to supported media files and build fullPath lookup
	const filesToIndex: FileToIndex[] = [];
	const relPathToFullPath = new Map<string, string>();
	for (const fullPath of scannedFiles) {
		const relativePath = toRelativePath(rootPath, fullPath);
		const mediaType = inferMediaType(relativePath, config.media.supportedExtensions);
		if (mediaType) {
			const normalizedRelPath = normalizeRelativePath(relativePath);
			filesToIndex.push({
				fullPath,
				relativePath,
				normalizedRelPath,
				mediaType,
			});
			relPathToFullPath.set(normalizedRelPath, fullPath);
		}
	}
	console.debug(`[sync] mediaFiles=${filesToIndex.length}`);

	// Probe files with limited concurrency and batch-insert, collecting returned IDs
	const actualMediaPaths = new Set(filesToIndex.map((file) => file.normalizedRelPath));
	let added = 0;
	const batch: Array<import("../repositories/media-repository").UpsertTauriMediaInput> = [];
	const batchNormPaths: string[] = [];
	const allReturned: Array<{ id: string; normalizedRelPath: string }> = [];

	const flushBatch = async () => {
		if (batch.length === 0) return;
		const toInsert = batch.splice(0);
		batchNormPaths.splice(0);
		const returned = await TauriMediaRepository.batchUpsert(toInsert);
		for (const row of returned) {
			allReturned.push({
				id: row.id,
				normalizedRelPath: normalizeRelativePath(row.filePath),
			});
		}
	};

	const probed = await probeAndCollect(source.id, filesToIndex);

	for (const { normalizedRelPath, ...input } of probed) {
		if (!dbPathMap.has(normalizedRelPath)) added++;
		batch.push(input);
		batchNormPaths.push(normalizedRelPath);
		if (batch.length >= INSERT_BATCH_SIZE) {
			await flushBatch();
		}
	}
	await flushBatch();

	// Emit events and enqueue thumbnail jobs for newly added files
	const newMediaJobs: ThumbnailJob[] = [];
	const now = new Date().toISOString();
	for (const { id, normalizedRelPath } of allReturned) {
		if (!dbPathMap.has(normalizedRelPath)) {
			void emit("media-added", {
				mediaSourceId: source.id,
				mediaId: id,
				filePath: normalizedRelPath,
				timestamp: now,
			});
			const fullPath = relPathToFullPath.get(normalizedRelPath);
			if (fullPath) {
				newMediaJobs.push({
					sourceId: source.id,
					mediaId: id,
					filePath: normalizedRelPath,
					fullPath,
				});
			}
		}
	}

	if (newMediaJobs.length > 0) {
		await tauriJobQueue.enqueue(newMediaJobs);
		console.debug(`[sync] enqueued ${newMediaJobs.length} thumbnail jobs`);
	}

	// Delete removed files
	let deleted = 0;
	for (const [relativePath, mediaId] of dbPathMap.entries()) {
		if (actualMediaPaths.has(relativePath)) continue;
		await TauriMediaRepository.delete(mediaId);
		await emit("media-deleted", {
			mediaSourceId: source.id,
			mediaId,
			filePath: relativePath,
			timestamp: new Date().toISOString(),
		});
		deleted += 1;
	}

	console.debug(`[sync] done: added=${added} deleted=${deleted}`);
	return { id: source.id, success: true, added, deleted };
}

export const TauriSourceService = {
	async list(): Promise<SafeMediaSource[]> {
		const sources = await TauriSourceRepository.findAll();
		return sources.map(toSafeMediaSource);
	},

	async get(id: string): Promise<SafeMediaSource | null> {
		const source = await TauriSourceRepository.findById(id);
		return source ? toSafeMediaSource(source) : null;
	},

	async create(input: NewMediaSource): Promise<SafeMediaSource> {
		if (input.type !== "local") {
			throw new Error("Tauri currently supports only local sources.");
		}
		const localPath = (input.connectionInfo as { path: string }).path;
		if (!(await getTauriAppServices().fileSystem.exists(localPath))) {
			throw new Error(`Source path does not exist: ${localPath}`);
		}
		const source = await TauriSourceRepository.create(input);
		await syncLocalSource(source);
		await startSourceWatcherSafely(source);
		return toSafeMediaSource(source);
	},

	async update(id: string, input: Partial<MediaSource>): Promise<SafeMediaSource> {
		const previousSource = await TauriSourceRepository.findById(id);
		if (!previousSource) {
			throw new Error(`Source not found: ${id}`);
		}
		if (input.type && input.type !== "local") {
			throw new Error("Tauri currently supports only local sources.");
		}
		const nextPath =
			input.connectionInfo && "path" in input.connectionInfo ? input.connectionInfo.path : null;
		if (nextPath && !(await getTauriAppServices().fileSystem.exists(nextPath))) {
			throw new Error(`Source path does not exist: ${nextPath}`);
		}
		const source = await TauriSourceRepository.update(id, input);
		await stopSourceWatcher(previousSource.id);
		if (source.type === "local") {
			await startSourceWatcherSafely(source);
		}
		return toSafeMediaSource(source);
	},

	async delete(id: string): Promise<void> {
		await stopSourceWatcher(id);
		await TauriSourceRepository.delete(id);
	},

	async startWatchingAllLocalSources(): Promise<void> {
		const sources = await TauriSourceRepository.findAll();
		await ensureSourceWatchListener();
		for (const source of sources) {
			if (source.type !== "local") {
				continue;
			}
			await startSourceWatcherSafely(source);
		}

		for (const source of sources) {
			if (source.type !== "local") {
				continue;
			}
			try {
				await syncLocalSource(source);
			} catch (error) {
				console.error("[watcher] failed to sync before start", source.id, error);
				await emit("watcher-error", {
					mediaSourceId: source.id,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
	},

	async sync(ids: string[]) {
		const results: SyncResult[] = [];

		for (const id of ids) {
			try {
				const source = await TauriSourceRepository.findById(id);
				if (!source) {
					throw new Error(`Source not found: ${id}`);
				}
				if (source.type !== "local") {
					results.push({ id, success: true, added: 0, deleted: 0 });
					continue;
				}
				results.push(await syncLocalSource(source));
			} catch (error) {
				results.push({
					id,
					success: false,
					added: 0,
					deleted: 0,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		return { results };
	},
};
