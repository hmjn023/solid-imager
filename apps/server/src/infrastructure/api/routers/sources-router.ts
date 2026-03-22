import { os } from "@orpc/server";
import type { MediaSource } from "@solid-imager/core/domain/repositories/source-repository";
import {
	mediaSourceInfoSchema,
	mediaSourceStatusSchema,
	type SafeMediaSource,
} from "@solid-imager/core/domain/sources/schemas";
import { z } from "zod";
import { BackupService } from "~/application/services/backup-service";
import { DirectorySyncService } from "~/application/services/directory-sync-service";
import { MediaService } from "~/application/services/media-service";
import { MediaSourceService } from "~/application/services/media-source-service";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { logger } from "~/infrastructure/logger";

/**
 * 機密情報を除外した安全な MediaSource に変換
 */
function toSafeMediaSource(source: MediaSource): SafeMediaSource {
	const { connectionInfo, ...rest } = source;
	// biome-ignore lint/suspicious/noExplicitAny: Dynamic connection info handling
	const info = connectionInfo as any;

	if (source.type === "local") {
		return {
			...rest,
			connectionInfo: {
				path: info.path,
			},
		};
	}
	if (source.type === "sftp") {
		return {
			...rest,
			type: source.type,
			connectionInfo: {
				host: info.host,
				port: info.port,
				username: info.username,
				remotePath: info.remotePath,
			},
		};
	}
	if (source.type === "s3") {
		return {
			...rest,
			type: source.type,
			connectionInfo: {
				bucket: info.bucket,
				region: info.region,
				prefix: info.prefix,
			},
		};
	}
	// Fallback for local
	return {
		...rest,
		type: source.type,
		connectionInfo: {
			path: info.path || "",
		},
	};
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
			for (const id of input.ids) {
				try {
					const result = await DirectorySyncService.syncMediaSource(id);
					results.push({ id, success: true, ...result });
				} catch (error) {
					logger.error(
						{ err: error, sourceId: id },
						"Failed to sync media source",
					);
					results.push({ id, success: false, error: String(error) });
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
				mode: z.enum(["json", "zip"]).default("json"),
			}),
		)
		.handler(async ({ input }) => {
			const result = await BackupService.createDump(input.id, input.mode);

			if (input.mode === "zip") {
				return new Response(result as ReadableStream, {
					headers: {
						"Content-Type": "application/zip",
						"Content-Disposition": `attachment; filename="source-${input.id}-dump.zip"`,
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
				data: z.array(z.any()),
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
			const nodeOs = await import("node:os");
			const fs = await import("node:fs");
			const { pipeline } = await import("node:stream/promises");
			const { Readable } = await import("node:stream");

			const tempFilePath = path.join(
				nodeOs.tmpdir(),
				`import-rpc-${randomUUID()}.zip`,
			);

			try {
				// Stream the file to disk
				const fileStream = input.file.stream();
				await pipeline(
					// biome-ignore lint/suspicious/noExplicitAny: Cast to any to assume compatibility with node stream if available in this environment
					Readable.fromWeb(fileStream as any),
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
			// biome-ignore lint/suspicious/noExplicitAny: Service return type mismatch?
			return status as any;
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
		.input(z.object({ id: z.string().uuid() }))
		.handler(async function* ({ input, signal }) {
			// Yield initial connection event
			yield { event: "connected", data: "connected" };

			// Queue for events
			// biome-ignore lint/suspicious/noExplicitAny: SSE payload
			const queue: { event: string; data: any }[] = [];
			let resolve: (() => void) | null = null;

			// biome-ignore lint/suspicious/noExplicitAny: SSE payload is dynamic
			const onEvent = (payload: { event: string; data: any }) => {
				queue.push(payload);
				if (resolve) {
					resolve();
					resolve = null;
				}
			};

			const eventName = `event:${input.id}`;
			SseManager.emitter.on(eventName, onEvent);

			try {
				while (!signal?.aborted) {
					if (queue.length === 0) {
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

					while (queue.length > 0) {
						const item = queue.shift();
						if (item) {
							yield item;
						}
					}
				}
			} finally {
				SseManager.emitter.off(eventName, onEvent);
			}
		}),
};
