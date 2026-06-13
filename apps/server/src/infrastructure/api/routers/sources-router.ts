import { os } from "@orpc/server";
import type { MediaSource } from "@solid-imager/core/domain/repositories/source-repository";
import {
	localConnectionSchema,
	mediaSourceInfoSchema,
	mediaSourceStatusSchema,
	type SafeMediaSource,
	s3ConnectionSchema,
	sftpConnectionSchema,
} from "@solid-imager/core/domain/sources/schemas";
import { asyncPool } from "@solid-imager/core/utils/async-pool";
import { isRecord } from "@solid-imager/core/utils/type-guards";
import { z } from "zod";
import { BackupService } from "~/application/services/backup-service";
import { DirectorySyncService } from "~/application/services/directory-sync-service";
import { MediaService } from "~/application/services/media-service";
import { MediaSourceService } from "~/application/services/media-source-service";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { logger } from "~/infrastructure/logger";
import {
	asDumpStream,
	nodeStreamToWebReadable,
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

/**
 * Media Sources Router Implementation
 */
export const sourcesRouter = {
	list: os
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "List all media sources",
				description:
					"Retrieve a list of all registered media sources with sensitive information removed",
			},
		})
		.handler(async () => {
			const sources = await MediaSourceService.fetchSources();
			return sources.map(toSafeMediaSource);
		}),

	get: os
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Get media source by ID",
				description: "Retrieve a specific media source by its UUID",
			},
		})
		.input(
			z.object({
				id: z.string().uuid(),
			}),
		)
		.handler(async ({ input }) => {
			const [source] = await MediaSourceService.fetchSourceById(input.id);
			if (!source) {
				throw new Error(`Source not found: ${input.id}`);
			}
			return toSafeMediaSource(source);
		}),

	create: os
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Create a new media source",
				description: "Register a new media source (local, SFTP, S3, etc.)",
			},
		})
		.input(mediaSourceInfoSchema)
		.handler(async ({ input }) => {
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

			return toSafeMediaSource(createdSource);
		}),

	update: os
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Update media source",
				description: "Update an existing media source's configuration",
			},
		})
		.input(
			z.object({
				id: z.string().uuid(),
				data: mediaSourceInfoSchema.partial(),
			}),
		)
		.handler(async ({ input }) => {
			const result = await MediaSourceService.updateSource(
				input.id,
				input.data,
			);
			return toSafeMediaSource(result[0]);
		}),

	/**
	 * Deletes a media source
	 */
	delete: os
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Delete media source",
				description: "Remove a media source and stop its file monitoring",
			},
		})
		.input(
			z.object({
				id: z.string().uuid(),
			}),
		)
		.handler(async ({ input }) => {
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
	sync: os
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Sync media sources",
				description: "Synchronize local media source directory with database",
			},
		})
		.input(
			z.object({
				ids: z.array(z.string().uuid()),
			}),
		)
		.handler(async ({ input }) => {
			const results: Record<string, unknown>[] = [];
			const poolResults = await asyncPool(input.ids, 3, (id: string) =>
				DirectorySyncService.syncMediaSource(id),
			);
			for (const [index, pr] of poolResults.entries()) {
				const id = input.ids[index];
				if (pr.status === "fulfilled") {
					results.push({
						id,
						success: true,
						...(isRecord(pr.value) ? pr.value : {}),
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
	dump: os
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Export media source",
				description: "Export media source data as JSON or ZIP archive",
			},
		})
		.input(
			z.object({
				id: z.string().uuid(),
				mode: z.enum(["json", "zip", "lancedb"]).default("json"),
				includeImages: z.boolean().optional().default(false),
			}),
		)
		.handler(async ({ input }) => {
			const result = await BackupService.createDump(input.id, input.mode, {
				includeImages: input.includeImages,
			});

			if (input.mode === "zip") {
				return new Response(asDumpStream(result), {
					headers: {
						"Content-Type": "application/zip",
						"Content-Disposition": `attachment; filename="source-${input.id}-dump.zip"`,
					},
				});
			}

			if (input.mode === "lancedb") {
				return new Response(asDumpStream(result), {
					headers: {
						"Content-Type": "application/gzip",
						"Content-Disposition": `attachment; filename="source-${input.id}-dump.tar.gz"`,
					},
				});
			}

			return result;
		}),
	restore: os
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Restore media source",
				description: "Restore media source from exported JSON data",
			},
		})
		.input(
			z.object({
				id: z.string().uuid(),
				data: z.array(z.unknown()),
			}),
		)
		.handler(
			async ({ input }) =>
				await BackupService.restoreSource(input.id, input.data),
		),

	/**
	 * Imports a media source from a Zip file
	 */
	importZip: os
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Import media source from ZIP",
				description: "Import media source data from a ZIP archive",
			},
		})
		.input(
			z.object({
				id: z.string().uuid(),
				file: z.instanceof(File),
			}),
		)
		.handler(async ({ input }) => {
			const { randomUUID } = await import("node:crypto");
			const path = await import("node:path");
			const fs = await import("node:fs");
			const { pipeline } = await import("node:stream/promises");

			const tempDir = path.join(process.cwd(), ".cache", "import");
			await fs.promises.mkdir(tempDir, { recursive: true });
			const tempFilePath = path.join(tempDir, `import-rpc-${randomUUID()}.zip`);

			try {
				// Stream the file to disk
				const fileStream = input.file.stream();
				await pipeline(
					webReadableToNodeStream(fileStream),
					fs.createWriteStream(tempFilePath),
				);

				return await BackupService.importSourceZip(input.id, tempFilePath);
			} finally {
				try {
					await fs.promises.unlink(tempFilePath);
				} catch {
					// ignore
				}
			}
		}),

	/**
	 * Imports a media source from a LanceDB tar.gz archive
	 */
	importLanceDB: os
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Import media source from LanceDB archive",
				description: "Import media source data from a LanceDB tar.gz archive",
			},
		})
		.input(
			z.object({
				id: z.string().uuid(),
				file: z.instanceof(File),
			}),
		)
		.handler(async ({ input }) => {
			const { randomUUID } = await import("node:crypto");
			const pathMod = await import("node:path");
			const fsSync = await import("node:fs");
			const { pipeline } = await import("node:stream/promises");

			const tempDir = pathMod.join(process.cwd(), ".cache", "lancedb-restore");
			await fsSync.promises.mkdir(tempDir, { recursive: true });
			const tempFilePath = pathMod.join(
				tempDir,
				`import-lancedb-${randomUUID()}.tar.gz`,
			);

			try {
				const fileStream = input.file.stream();
				await pipeline(
					webReadableToNodeStream(fileStream),
					fsSync.createWriteStream(tempFilePath),
				);

				return await BackupService.importLanceDB(input.id, tempFilePath);
			} finally {
				try {
					await fsSync.promises.unlink(tempFilePath);
				} catch {
					// ignore
				}
			}
		}),

	/**
	 * Get status of a media source
	 */
	status: os
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Get media source status",
				description: "Retrieve current status and statistics of a media source",
			},
		})
		.input(z.object({ id: z.string().uuid() }))
		.output(mediaSourceStatusSchema)
		.handler(async ({ input }) => {
			const status = await MediaSourceService.getStatus(input.id);
			return status as z.infer<typeof mediaSourceStatusSchema>;
		}),

	/**
	 * Real-time events stream for a media source
	 */
	events: os
		.meta({
			openapi: {
				tags: ["Media Sources"],
				summary: "Subscribe to media source events",
				description:
					"Real-time Server-Sent Events stream for media source updates",
			},
		})
		.input(z.object({ id: z.string().uuid().or(z.literal("*")) }))
		.handler(async function* ({ input, signal }) {
			// Yield initial connection event
			yield { event: "connected", data: "connected" };

			// Queue for events — use pointer index instead of shift()
			const queue: { event: string; data: unknown }[] = [];
			let head = 0;
			let resolve: (() => void) | null = null;

			const onEvent = (payload: { event: string; data: unknown }) => {
				queue.push(payload);
				if (resolve) {
					resolve();
					resolve = null;
				}
			};

			const eventName = input.id === "*" ? "event:*" : `event:${input.id}`;
			SseManager.emitter.on(eventName, onEvent);

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
				SseManager.emitter.off(eventName, onEvent);
			}
		}),
};
