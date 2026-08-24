import { randomUUID } from "node:crypto";
import { implement, ORPCError } from "@orpc/server";
import {
	type SourceSyncResult,
	sourcesContract,
} from "@solid-imager/core/domain/contract/sources.contract";
import type { MediaSource } from "@solid-imager/core/domain/repositories/source-repository";
import type { SourceEvent } from "@solid-imager/core/domain/sources/events";
import {
	localConnectionSchema,
	mediaSourceStatusSchema,
	type SafeMediaSource,
	s3ConnectionSchema,
	sftpConnectionSchema,
} from "@solid-imager/core/domain/sources/schemas";
import { asyncPool } from "@solid-imager/core/utils/async-pool";
import { count, inArray } from "drizzle-orm";
import { toJobDto } from "~/infrastructure/api/routers/jobs-router";
import { db } from "~/infrastructure/db";
import { medias } from "~/infrastructure/db/schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";
import { allocateJobId } from "~/infrastructure/repositories/job-repository";
import { services } from "~/infrastructure/service-registry";
import { BackupService } from "~/infrastructure/services/backup-service";
import { DirectorySyncService } from "~/infrastructure/services/directory-sync-service";
import { persistJobInput } from "~/infrastructure/services/job-transfer-storage";
import { MediaService } from "~/infrastructure/services/media-service";
import { MediaSourceService } from "~/infrastructure/services/media-source-service";
import {
	asDumpStream,
	webReadableToNodeStream,
} from "~/infrastructure/utils/stream-utils";

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
	throw new Error(`Unsupported source type: ${source.type}`);
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
			MediaService.registerExistingMedia(
				createdSource.id,
				(createdSource.connectionInfo as { path: string }).path,
			);

			// ファイル監視の開始
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
		const mediaCounts = await getMediaCounts([result[0].id]);
		return addSourceSummary(toSafeMediaSource(result[0]), mediaCounts);
	}),

	/**
	 * Deletes a media source
	 */
	delete: os.delete.handler(async ({ input }) => {
		await MediaSourceService.deleteSource(input.id);

		// ファイル監視の停止
		import("~/infrastructure/jobs/file-watcher-service")
			.then((module) => {
				module.FileWatcherService.stopMonitoring(input.id).catch((error) => {
					logger.error(
						{ err: error, sourceId: input.id },
						"Failed to stop file watcher",
					);
				});
			})
			.catch((error) => {
				logger.error(
					{ err: error, sourceId: input.id },
					"Failed to load file watcher service",
				);
			});

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
					success: true,
					...pr.value,
				});
			} else {
				logger.error(
					{ err: pr.reason, sourceId: id },
					"Failed to sync media source",
				);
				results.push({ id, success: false, error: String(pr.reason) });
			}
		}
		return { results };
	}),

	/**
	 * Dumps a media source
	 */
	dump: os.dump.handler(async ({ input }) => {
		const result = await BackupService.createDump(input.id, input.mode, {
			includeImages: input.includeImages,
		});

		if (input.mode === "zip") {
			return new Response(asDumpStream(result), {
				headers: {
					"Content-Type": "application/x-tar",
					"Content-Disposition": `attachment; filename="source-${input.id}-dump.tar"`,
				},
			});
		}

		// Mode json -> return as streaming NDJSON Response
		return new Response(asDumpStream(result), {
			headers: {
				"Content-Type": "application/x-ndjson",
				"Content-Disposition": `attachment; filename="source-${input.id}-dump.ndjson"`,
			},
		});
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
	restore: os.restore.handler(
		async ({ input }) =>
			await BackupService.restoreSource(input.id, input.data),
	),

	/**
	 * Imports a media source from a Tar file
	 */
	importZip: os.importZip.handler(async ({ input }) => {
		const path = await import("node:path");
		const fs = await import("node:fs");
		const { pipeline } = await import("node:stream/promises");

		const tempDir = path.join(process.cwd(), ".cache", "import");
		await fs.promises.mkdir(tempDir, { recursive: true });
		const tempFilePath = path.join(tempDir, `import-rpc-${randomUUID()}.tar`);

		try {
			const fileStream = input.file.stream();
			await pipeline(
				webReadableToNodeStream(fileStream),
				fs.createWriteStream(tempFilePath),
			);

			return await BackupService.importSourceTar(input.id, tempFilePath);
		} finally {
			try {
				await fs.promises.unlink(tempFilePath);
			} catch {
				// ignore
			}
		}
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
	 * Imports a media source from a streaming NDJSON file
	 */
	importNdjson: os.importNdjson.handler(async ({ input }) => {
		const path = await import("node:path");
		const fs = await import("node:fs");
		const { pipeline } = await import("node:stream/promises");

		const tempDir = path.join(process.cwd(), ".cache", "import");
		await fs.promises.mkdir(tempDir, { recursive: true });
		const tempFilePath = path.join(
			tempDir,
			`import-rpc-${randomUUID()}.ndjson`,
		);

		try {
			const fileStream = input.file.stream();
			await pipeline(
				webReadableToNodeStream(fileStream),
				fs.createWriteStream(tempFilePath),
			);

			return await BackupService.importSourceNdjson(input.id, tempFilePath);
		} finally {
			try {
				await fs.promises.unlink(tempFilePath);
			} catch {
				// ignore
			}
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
