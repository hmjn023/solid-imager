import { ORPCError, os } from "@orpc/server";
import {
	conflictResolutionRequestSchema,
	getSourceSyncStatusRequestSchema,
	getSyncStatusRequestSchema,
	mediaListRequestSchema,
	mediaMetadataRequestSchema,
	pullMediaFileRequestSchema,
	pushMediaFileRequestSchema,
	syncRequestSchema,
} from "@solid-imager/core/domain/media/sync-schemas";
import { BidirectionalSyncServiceImpl } from "~/application/services/bidirectional-sync-service";
import { MediaProcessingService } from "~/application/services/media-processing-service";
import { logger } from "~/infrastructure/logger";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { ServerMediaStorage } from "~/infrastructure/storage/server-media-storage";

const sourceRepo = new DrizzleSourceRepository();

function createSyncService() {
	return new BidirectionalSyncServiceImpl(MediaRepository, sourceRepo);
}

/**
 * Remote Sync Router Implementation
 * Handles server-to-server media synchronization
 */
export const syncRouter = {
	/**
	 * Get media list from remote server
	 * Used for diff detection and synchronization
	 */
	getMediaList: os
		.meta({
			openapi: {
				tags: ["Sync"],
				summary: "Get media list from remote server",
				description:
					"Retrieves a paginated list of media items from a remote server for synchronization purposes.",
			},
		})
		.input(mediaListRequestSchema)
		.handler(async ({ input }) => {
			try {
				const source = await sourceRepo.findById(input.sourceId);
				if (!source || source.type !== "local") {
					throw new Error(`Source not found or not local: ${input.sourceId}`);
				}

				const offset = input.cursor ? Number.parseInt(input.cursor, 10) : 0;
				const result = await MediaRepository.search(input.sourceId, {
					limit: input.limit,
					offset: Number.isNaN(offset) ? 0 : offset,
					order: "desc",
				});
				const hashes = await MediaRepository.getMd5HashesBySourceId(
					input.sourceId,
				);
				const nextOffset =
					(Number.isNaN(offset) ? 0 : offset) + result.media.length;

				return {
					media: result.media.map((media) => ({
						id: media.id,
						filePath: media.filePath,
						fileName: media.fileName,
						fileSize: media.fileSize ?? 0,
						mediaType: media.mediaType,
						width: media.width,
						height: media.height,
						createdAt: media.createdAt,
						modifiedAt: media.modifiedAt,
						hashMd5: hashes.get(media.id) ?? null,
						description: media.description,
					})),
					total: result.total,
					hasMore: nextOffset < result.total,
					cursor: nextOffset < result.total ? String(nextOffset) : undefined,
				};
			} catch (error) {
				throw new ORPCError("REMOTE_SYNC_ERROR", {
					message: `Failed to get media list from remote: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
		}),

	/**
	 * Get media metadata from remote server
	 * Includes tags, generation info, and other metadata
	 */
	getMediaMetadata: os
		.meta({
			openapi: {
				tags: ["Sync"],
				summary: "Get media metadata from remote server",
				description:
					"Retrieves detailed metadata for a specific media item from a remote server.",
			},
		})
		.input(mediaMetadataRequestSchema)
		.handler(async ({ input }) => {
			try {
				const source = await sourceRepo.findById(input.sourceId);
				if (!source || source.type !== "local") {
					throw new Error(`Source not found or not local: ${input.sourceId}`);
				}

				const details = await MediaRepository.getDetails(input.mediaId);
				if (!details || details.mediaSourceId !== input.sourceId) {
					throw new Error(`Media not found in source: ${input.mediaId}`);
				}

				const hashes = await MediaRepository.getMd5HashesBySourceId(
					input.sourceId,
				);
				return {
					media: {
						id: details.id,
						filePath: details.filePath,
						fileName: details.fileName,
						fileSize: details.fileSize ?? 0,
						mediaType: details.mediaType,
						width: details.width,
						height: details.height,
						createdAt: details.createdAt,
						modifiedAt: details.modifiedAt,
						hashMd5: hashes.get(details.id) ?? null,
						description: details.description,
					},
					tags: details.tags.map((tag) => ({
						id: tag.id,
						name: tag.name,
						category: tag.attribute,
					})),
					generationInfo: details.generationInfo
						? {
								prompt: details.generationInfo.prompt,
								negativePrompt: details.generationInfo.negativePrompt,
								workflow: details.generationInfo.workflow,
								model: details.generationInfo.modelName,
								steps: details.generationInfo.steps,
								cfgScale: details.generationInfo.cfgScale,
								seed: details.generationInfo.seed,
							}
						: null,
				};
			} catch (error) {
				throw new ORPCError("REMOTE_SYNC_ERROR", {
					message: `Failed to get media metadata from remote: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
		}),

	/**
	 * Push media file with full metadata to this server.
	 * Used by remote servers to transfer media during sync.
	 */
	pushMediaFile: os
		.meta({
			openapi: {
				tags: ["Sync"],
				summary: "Push media file with full metadata",
				description:
					"Receives a media file and its complete metadata from a remote server for synchronization.",
			},
		})
		.input(pushMediaFileRequestSchema)
		.handler(async ({ input }) => {
			try {
				const source = await sourceRepo.findById(input.targetSourceId);
				if (!source || source.type !== "local") {
					throw new Error(
						`Target source not found or not local: ${input.targetSourceId}`,
					);
				}

				const basePath = (source.connectionInfo as { path: string }).path;
				const arrayBuffer = await input.file.arrayBuffer();

				const fileInfo = await ServerMediaStorage.saveFile(
					basePath,
					{
						name: input.fileName ?? input.file.name,
						arrayBuffer: async () => arrayBuffer,
					},
					{
						filename: input.fileName ?? input.file.name,
						overwrite: false,
						autoIncrement: true,
					},
				);

				const media = await MediaProcessingService.registerAndProcess(
					input.targetSourceId,
					fileInfo.filePath,
					{
						description: input.description ?? undefined,
						createdAt: input.createdAt,
						sourceUrls: input.sourceUrls,
						authors: input.authors,
						tags: input.tags,
						characters: input.characters,
						ips: input.ips,
						projects: input.projects,
						generationInfo: input.generationInfo,
					},
				);

				return { success: true, mediaId: media.id };
			} catch (error) {
				logger.error({ error }, "Failed to push media file");
				return {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		}),

	/**
	 * Pull media file with full metadata from this server.
	 * Used by remote servers to retrieve media during sync.
	 */
	pullMediaFile: os
		.meta({
			openapi: {
				tags: ["Sync"],
				summary: "Pull media file with full metadata",
				description:
					"Returns a media file (base64) and its complete metadata for a remote server to retrieve during synchronization.",
			},
		})
		.input(pullMediaFileRequestSchema)
		.handler(async ({ input }) => {
			try {
				const source = await sourceRepo.findById(input.sourceId);
				if (!source || source.type !== "local") {
					throw new Error(`Source not found or not local: ${input.sourceId}`);
				}

				const details = await MediaRepository.getDetails(input.mediaId);
				if (!details) {
					throw new Error(`Media not found: ${input.mediaId}`);
				}

				const basePath = (source.connectionInfo as { path: string }).path;
				const fileContent = await ServerMediaStorage.getFile(
					basePath,
					details.filePath,
				);
				const fileData = Buffer.from(fileContent).toString("base64");

				const ext = details.fileName.split(".").pop()?.toLowerCase() ?? "";
				const mimeMap: Record<string, string> = {
					png: "image/png",
					jpg: "image/jpeg",
					jpeg: "image/jpeg",
					gif: "image/gif",
					webp: "image/webp",
					mp4: "video/mp4",
					webm: "video/webm",
					mp3: "audio/mpeg",
				};

				return {
					success: true,
					fileData,
					fileName: details.fileName,
					mimeType: mimeMap[ext] ?? "application/octet-stream",
					description: details.description,
					createdAt: details.createdAt,
					sourceUrls: details.urls.map((u: { url: string }) => u.url),
					authors: details.authors.map(
						(a: { name: string; accountId: string | null }) => ({
							name: a.name,
							accountId: a.accountId,
						}),
					),
					tags: details.tags.map(
						(t: {
							name: string;
							type: "positive" | "negative";
							confidence?: number | null;
						}) => ({
							name: t.name,
							type: t.type,
							confidence: t.confidence,
						}),
					),
					characters: details.characters.map(
						(c: { name: string; confidence?: number | null }) => ({
							name: c.name,
							confidence: c.confidence,
						}),
					),
					ips: details.ips.map(
						(ip: { name: string; confidence?: number | null }) => ({
							name: ip.name,
							confidence: ip.confidence,
						}),
					),
					generationInfo: details.generationInfo
						? {
								prompt: details.generationInfo.prompt,
								negativePrompt: details.generationInfo.negativePrompt,
								modelName: details.generationInfo.modelName,
								seed: details.generationInfo.seed,
								steps: details.generationInfo.steps,
								cfgScale: details.generationInfo.cfgScale,
								aiGenerated: details.generationInfo.aiGenerated,
							}
						: null,
				};
			} catch (error) {
				logger.error({ error }, "Failed to pull media file");
				return {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		}),

	/**
	 * Execute bidirectional sync between local and remote sources
	 * Detects differences and synchronizes media in both directions
	 */
	sync: os
		.meta({
			openapi: {
				tags: ["Sync"],
				summary: "Execute bidirectional sync",
				description:
					"Performs bidirectional synchronization between local and remote media sources.",
			},
		})
		.input(syncRequestSchema)
		.handler(async ({ input }) => {
			try {
				const syncService = createSyncService();
				return await syncService.sync(input);
			} catch (error) {
				throw new ORPCError("REMOTE_SYNC_ERROR", {
					message: `Failed to execute sync: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
		}),

	/**
	 * Resolve sync conflict
	 * Handles conflict resolution for media synchronization
	 */
	resolveConflict: os
		.meta({
			openapi: {
				tags: ["Sync"],
				summary: "Resolve sync conflict",
				description:
					"Resolves a conflict that occurred during media synchronization.",
			},
		})
		.input(conflictResolutionRequestSchema)
		.handler(async ({ input }) => {
			try {
				return await createSyncService().resolveConflict(input);
			} catch (error) {
				throw new ORPCError("REMOTE_SYNC_ERROR", {
					message: `Failed to resolve conflict: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
		}),

	/**
	 * Get sync status for a media item
	 * Returns current synchronization status and details
	 */
	getSyncStatus: os
		.meta({
			openapi: {
				tags: ["Sync"],
				summary: "Get sync status",
				description: "Retrieves synchronization status for a media item.",
			},
		})
		.input(getSyncStatusRequestSchema)
		.handler(async ({ input }) => {
			try {
				return await createSyncService().getSyncStatus(
					input.mediaId,
					input.remoteSourceId,
				);
			} catch (error) {
				throw new ORPCError("REMOTE_SYNC_ERROR", {
					message: `Failed to get sync status: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
		}),

	/**
	 * Get sync status for all media in a source
	 * Returns synchronization status summary for a source
	 */
	getSourceSyncStatus: os
		.meta({
			openapi: {
				tags: ["Sync"],
				summary: "Get source sync status",
				description:
					"Retrieves synchronization status summary for a media source.",
			},
		})
		.input(getSourceSyncStatusRequestSchema)
		.handler(async ({ input }) => {
			try {
				return await createSyncService().getSourceSyncStatus(
					input.sourceId,
					input.remoteSourceId,
				);
			} catch (error) {
				throw new ORPCError("REMOTE_SYNC_ERROR", {
					message: `Failed to get source sync status: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
		}),
};
