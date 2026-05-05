import {
	createSourceService,
	toSafeMediaSource,
} from "@solid-imager/application/services/source-service";
import {
	createSourceSyncRuntime,
	parseSourceWatchEventPayload,
	type SourceSyncResult,
} from "@solid-imager/application/services/source-sync-runtime";
import type {
	MediaSource,
	NewMediaSource,
	SourceRepository,
} from "@solid-imager/core/domain/repositories/source-repository";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { emit, listen } from "@tauri-apps/api/event";
import { getTauriAppServices } from "~/app-services";
import { tauriJobQueue } from "../../jobs/tauri-job-queue";
import { basename, joinLocalPath, toRelativePath } from "../../path-utils";
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

type ProbeMediaBatchItemResult = {
	mediaPath: string;
	result: ProbeMediaResult | null;
	error: string | null;
};

const sourceWatchers = new Map<string, true>();
const WATCH_START_RETRY_DELAY_MS = 5_000;
const watchRetryTimers = new Map<string, ReturnType<typeof setTimeout>>();
let sourceWatchListenerReady: Promise<void> | null = null;

const sourceRepository: SourceRepository = TauriSourceRepository;
const sourceService = createSourceService({
	repository: sourceRepository,
	connectionTester: {
		async testConnection(source) {
			if (source.type !== "local") {
				return {
					success: false,
					message: `Tauri source service does not support source type: ${source.type}`,
				};
			}

			const rootPath = getLocalSourceRootPath(source);
			const fs = getTauriAppServices().fileSystem;
			if (!(await fs.exists(rootPath))) {
				return {
					success: false,
					message: `Source path does not exist: ${rootPath}`,
				};
			}

			const stat = await fs.stat(rootPath);
			if (!stat.isDirectory) {
				return {
					success: false,
					message: `Source path is not a directory: ${rootPath}`,
				};
			}

			return { success: true };
		},
	},
});

function getLocalConnectionPath(connectionInfo: MediaSource["connectionInfo"]) {
	if (!("path" in connectionInfo) || typeof connectionInfo.path !== "string") {
		throw new Error("Local source connectionInfo.path is required.");
	}
	return connectionInfo.path;
}

function getLocalSourceRootPath(
	source: Pick<MediaSource, "type" | "connectionInfo">,
) {
	if (source.type !== "local") {
		throw new Error(
			`Tauri currently supports only local sources: ${source.type}`,
		);
	}
	return getLocalConnectionPath(source.connectionInfo);
}

async function ensureLocalSourcePathExists(rootPath: string): Promise<void> {
	if (!(await getTauriAppServices().fileSystem.exists(rootPath))) {
		throw new Error(`Source path does not exist: ${rootPath}`);
	}
}

async function requireSource(id: string): Promise<MediaSource> {
	const source = await sourceService.get(id);
	if (!source) {
		throw new Error(`Source not found: ${id}`);
	}
	return source;
}

const sourceSyncRuntime = createSourceSyncRuntime({
	resolveSourceRootPath: getLocalSourceRootPath,
	toRelativePath,
	joinPath: joinLocalPath,
	basename,
	fileSystem: {
		exists: async (path) => await getTauriAppServices().fileSystem.exists(path),
		stat: async (path) => await getTauriAppServices().fileSystem.stat(path),
		readdir: async (path) =>
			await getTauriAppServices().fileSystem.readdir(path),
		scanDirectoryRecursive: async (path) => {
			const fn = getTauriAppServices().fileSystem.scanDirectoryRecursive;
			if (!fn) throw new Error("scanDirectoryRecursive not available");
			return await fn(path);
		},
	},
	config: {
		getSupportedExtensions: async () =>
			(await TauriConfigService.getConfig()).media.supportedExtensions,
		getProbeConcurrency: async () =>
			(await TauriConfigService.getConfig()).jobs.concurrency,
	},
	probeMedia: async (fullPath) =>
		await getTauriAppServices().commandClient.invoke<ProbeMediaResult>(
			"probe_media",
			{ mediaPath: fullPath },
		),
	batchProbeMedia: async (paths) => {
		const results = await getTauriAppServices().commandClient.invoke<
			ProbeMediaBatchItemResult[]
		>("probe_media_batch", { mediaPaths: paths });
		return results.map((item) => ({
			mediaPath: item.mediaPath,
			result: item.result
				? {
						width: item.result.width,
						height: item.result.height,
						size: item.result.size,
						createdAt: item.result.createdAt,
						modifiedAt: item.result.modifiedAt,
						duration: item.result.duration ?? null,
						mimeType: item.result.mimeType ?? null,
						codec: item.result.codec ?? null,
					}
				: null,
			error: item.error,
		}));
	},
	mediaRepository: {
		findByPath: TauriMediaRepository.findByPath,
		findAllPathsBySourceId: TauriMediaRepository.findAllPathsBySourceId,
		batchUpsert: TauriMediaRepository.batchUpsert,
		delete: TauriMediaRepository.delete,
		deleteByPathPrefix: TauriMediaRepository.deleteBySourceIdAndPathPrefix,
	},
	enqueueProcessMediaJobs: async (jobs) => {
		await tauriJobQueue.enqueue(jobs);
	},
	events: {
		mediaAdded: async (event) => {
			await emit("media-added", event);
		},
		mediaChanged: async (event) => {
			await emit("media-changed", event);
		},
		mediaDeleted: async (event) => {
			await emit("media-deleted", event);
		},
	},
	logger: {
		debug: (message, meta) => {
			console.debug(message, meta ?? {});
		},
		error: (message, error) => {
			console.error(message, error);
		},
	},
});

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
				const source = await sourceService.get(payload.mediaSourceId);
				if (!source || source.type !== "local") {
					return;
				}

				for (const path of payload.paths) {
					await sourceSyncRuntime
						.reconcileWatchedPath(source, path)
						.catch(async (error) => {
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

	const rootPath = getLocalSourceRootPath(source);
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

async function syncLocalSource(source: MediaSource): Promise<SourceSyncResult> {
	return await sourceSyncRuntime.syncLocalSource(source);
}

export const TauriSourceService = {
	async list(): Promise<SafeMediaSource[]> {
		return await sourceService.listSafe();
	},

	async get(id: string): Promise<SafeMediaSource | null> {
		return await sourceService.getSafe(id);
	},

	async create(input: NewMediaSource): Promise<SafeMediaSource> {
		if (input.type !== "local") {
			throw new Error("Tauri currently supports only local sources.");
		}
		const localPath = getLocalConnectionPath(input.connectionInfo);
		await ensureLocalSourcePathExists(localPath);
		const source = await sourceRepository.create(input);
		await syncLocalSource(source);
		await startSourceWatcherSafely(source);
		return toSafeMediaSource(source);
	},

	async update(
		id: string,
		input: Partial<MediaSource>,
	): Promise<SafeMediaSource> {
		const previousSource = await requireSource(id);
		if (input.type && input.type !== "local") {
			throw new Error("Tauri currently supports only local sources.");
		}
		const nextPath =
			input.connectionInfo && "path" in input.connectionInfo
				? input.connectionInfo.path
				: null;
		if (nextPath) {
			await ensureLocalSourcePathExists(nextPath);
		}
		const source = await sourceRepository.update(id, input);
		await stopSourceWatcher(previousSource.id);
		if (source.type === "local") {
			await startSourceWatcherSafely(source);
		}
		return toSafeMediaSource(source);
	},

	async delete(id: string): Promise<void> {
		await stopSourceWatcher(id);
		await sourceRepository.delete(id);
	},

	async startWatchingAllLocalSources(): Promise<void> {
		const sources = await sourceService.list();
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
				console.error(
					"[watcher] failed to sync before start",
					source.id,
					error,
				);
				await emit("watcher-error", {
					mediaSourceId: source.id,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
	},

	async sync(ids: string[]) {
		const results: SourceSyncResult[] = [];

		for (const id of ids) {
			try {
				const source = await requireSource(id);
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

	async testConnection(id: string) {
		return await sourceService.testConnection(id);
	},

	async getStatus(id: string) {
		return await sourceService.getStatus(id);
	},
};
