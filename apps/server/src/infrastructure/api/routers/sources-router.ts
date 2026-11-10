import { implement, ORPCError } from "@orpc/server";
import {
	type SourceSyncResult,
	sourcesContract,
} from "@solid-imager/core/contract";
import {
	type MediaSource,
	localConnectionSchema,
	mediaSourceStatusSchema,
	type SafeMediaSource,
	s3ConnectionSchema,
	sftpConnectionSchema,
} from "@solid-imager/core/sources";
import type { SourceEvent } from "@solid-imager/core/events";
import { asyncPool } from "@solid-imager/core/utils";
import { count, inArray } from "drizzle-orm";
import { toJobDto } from "~/infrastructure/api/routers/jobs-router";
import { db } from "~/infrastructure/db";
import { medias } from "~/infrastructure/db/schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";
import { allocateJobId } from "~/infrastructure/db/repositories";
import { services } from "~/infrastructure/service-registry";
import { DirectorySyncService } from "~/infrastructure/services/directory-sync-service";
import { persistJobInput } from "~/infrastructure/services/job-transfer-storage";
import { MediaSourceService } from "~/infrastructure/services/media-source-service";

/**
 * 機密情報を除外した安全な MediaSource に変換
 */
function toSafeMediaSource(source: MediaSource): SafeMediaSource {
	const { connectionInfo, ...rest } = source;

	if (source.type === "local") {
		const parsed = localConnectionSchema.safeParse(connectionInfo);
		return {
			...rest,
			connectionInfo: {
				path: parsed.success ? parsed.data.path : "",
			},
		};
	}
	if (source.type === "sftp") {
		const parsed = sftpConnectionSchema.safeParse(connectionInfo);
		return {
			...rest,
			type: source.type,
			connectionInfo: {
				host: parsed.success ? parsed.data.host : "",
				port: parsed.success ? parsed.data.port : 22,
				username: parsed.success ? parsed.data.username : "",
				remotePath: parsed.success ? parsed.data.remotePath : "",
			},
		};
	}
	if (source.type === "s3") {
		const parsed = s3ConnectionSchema.safeParse(connectionInfo);
		return {
			...rest,
			type: source.type,
			connectionInfo: {
				region: parsed.success ? parsed.data.region : "",
				bucket: parsed.success ? parsed.data.bucket : "",
				prefix:
					parsed.success && parsed.data.prefix ? parsed.data.prefix : undefined,
			},
		};
	}
	throw new Error(`Unsupported source type: ${String(source.type)}`);
}

async function getMediaCounts(
	sourceIds: string[],
): Promise<Map<string, number>> {
	if (sourceIds.length === 0) {
		return new Map();
	}

	const rows = await db
		.select({ mediaCount: count(), sourceId: medias.mediaSourceId })
		.from(medias)
		.where(inArray(medias.mediaSourceId, sourceIds))
		.groupBy(medias.mediaSourceId);

	return new Map(
		rows.map((row) => [row.sourceId, Number(row.mediaCount)] as const),
	);
}

function addSourceSummary(
	source: SafeMediaSource,
	mediaCounts: Map<string, number>,
): SafeMediaSource {
	if (!source.id) {
		return source;
	}
	return {
		...source,
		mediaCount: mediaCounts.get(source.id) ?? 0,
		syncStatus: source.syncStatus ?? "idle",
	};
}

/**
 * Media Sources Router Implementation
 */
const os = implement(sourcesContract);

export const sourcesRouter = os.router({
	list: os.list.handler(async () => {
		const sources = await MediaSourceService.fetchSources();
		const mediaCounts = await getMediaCounts(
			sources.map((source) => source.id),
		);
		return sources.map((source) =>
			addSourceSummary(toSafeMediaSource(source), mediaCounts),
		);
	}),

	get: os.get.handler(async ({ input }) => {
		const [source] = await MediaSourceService.fetchSourceById(input.id);
		if (!source) {
			throw new Error(`Source not found: ${input.id}`);
		}
		const mediaCounts = await getMediaCounts([source.id]);
		return addSourceSummary(toSafeMediaSource(source), mediaCounts);
	}),

	create: os.create.handler(async ({ input }) => {
		const result = await MediaSourceService.createSource(input);
		const createdSource = result[0];

		// ローカルソースの場合、バックグラウンド処理を開始
		if (createdSource && createdSource.type === "local") {
			// Monitoring performs the initial directory sync. Starting a second
			// registration path here races with that sync and duplicates work.
			import("~/infrastructure/jobs/file-watcher-service")
				.then((module) => {
					module.FileWatcherService.startMonitoring(createdSource.id).catch(
						(error) => {
							logger.error(
								{ err: error, sourceId: createdSource.id },
								"Failed to start file watcher",
							);
						},
					);
				})
				.catch((error) => {
					logger.error(
						{ err: error, sourceId: createdSource.id },
						"Failed to load file watcher service",
					);
				});
		}

		const mediaCounts = await getMediaCounts([createdSource.id]);
		return addSourceSummary(toSafeMediaSource(createdSource), mediaCounts);
	}),

	update: os.update.handler(async ({ input }) => {
		const result = await MediaSourceService.updateSource(input.id, input.data);
		const { FileWatcherService } =
			await import("~/infrastructure/jobs/file-watcher-service");
		if (result[0].type === "local") {
			void FileWatcherService.startMonitoring(input.id);
		} else {
			await FileWatcherService.stopMonitoring(input.id);
		}
		const mediaCounts = await getMediaCounts([result[0].id]);
		return addSourceSummary(toSafeMediaSource(result[0]), mediaCounts);
	}),

	/**
	 * Deletes a media source
	 */
	delete: os.delete.handler(async ({ input }) => {
		// Invalidate pending starts before deleting the source, and wait for handle release.
		const { FileWatcherService } =
			await import("~/infrastructure/jobs/file-watcher-service");
		await FileWatcherService.stopMonitoring(input.id);
		await MediaSourceService.deleteSource(input.id);

		return { success: true };
	}),

	/**
	 * Syncs one or more media sources
	 */
	sync: os.sync.handler(async ({ input }) => {
		const results: SourceSyncResult[] = [];
		const poolResults = await asyncPool(input.ids, 3, (id: string) =>
			DirectorySyncService.syncMediaSource(id),
		);
		for (const [index, pr] of poolResults.entries()) {
			const id = input.ids[index];
			if (pr.status === "fulfilled") {
				results.push({
					id,
					...pr.value,
				});
			} else {
				logger.error(
					{ err: pr.reason, sourceId: id },
					"Failed to sync media source",
				);
				results.push({
					id,
					sourceId: id,
					added: 0,
					deleted: 0,
					failed: 1,
					success: false,
					error: "Directory sync failed",
				});
			}
		}
		return { results };
	}),

	enqueueExport: os.enqueueExport.handler(async ({ input }) => {
		const [source] = await MediaSourceService.fetchSourceById(input.id);
		if (!source) {
			throw new ORPCError("NOT_FOUND", {
				message: `Source not found: ${input.id}`,
			});
		}

		const job = await services.getJobRepository().create({
			type: "source_export",
			mediaSourceId: input.id,
			payload: {
				mode: input.mode,
				includeImages: input.includeImages,
			},
		});
		return toJobDto(job);
	}),
	enqueueImport: os.enqueueImport.handler(async ({ input }) => {
		const [source] = await MediaSourceService.fetchSourceById(input.id);
		if (!source) {
			throw new ORPCError("NOT_FOUND", {
				message: `Source not found: ${input.id}`,
			});
		}

		const jobId = await allocateJobId();
		const inputPath = await persistJobInput(jobId, input.mode, input.file);
		try {
			const job = await services.getJobRepository().create({
				id: jobId,
				type: "source_restore",
				mediaSourceId: input.id,
				payload: {
					mode: input.mode,
					inputPath,
				},
			});
			return toJobDto(job);
		} catch (error) {
			const fs = await import("node:fs/promises");
			await fs.rm(inputPath, { force: true }).catch(() => {});
			throw error;
		}
	}),

	/**
	 * Get status of a media source
	 */
	status: os.status.handler(async ({ input }) => {
		return mediaSourceStatusSchema.parse(
			await MediaSourceService.getStatus(input.id),
		);
	}),

	/**
	 * Real-time events stream for a media source
	 */
	events: os.events.handler(async function* ({ input, signal }) {
		// Queue for events — use pointer index instead of shift()
		const queue: SourceEvent[] = [];
		let head = 0;
		let resolve: (() => void) | null = null;

		const onEvent = (payload: SourceEvent) => {
			queue.push(payload);
			if (resolve) {
				resolve();
				resolve = null;
			}
		};

		const unsubscribe = RealtimeEventBus.subscribeToSource(input.id, onEvent);

		try {
			while (!signal?.aborted) {
				if (head >= queue.length) {
					await new Promise<void>((r) => {
						const onAbort = () => {
							r();
						};
						if (signal) {
							signal.addEventListener("abort", onAbort, { once: true });
						}
						resolve = () => {
							if (signal) {
								signal.removeEventListener("abort", onAbort);
							}
							r();
						};
					});
				}

				while (head < queue.length) {
					yield queue[head++];
				}

				// Periodically trim stale entries to prevent memory leak
				if (head > 1000) {
					queue.splice(0, head);
					head = 0;
				}
			}
		} finally {
			unsubscribe();
		}
	}),
});
