import { ORPCError, os } from "@orpc/server";
import {
	conflictResolutionRequestSchema,
	mediaListRequestSchema,
	mediaMetadataRequestSchema,
	pullMediaRequestSchema,
	pushMediaRequestSchema,
	syncRequestSchema,
} from "@solid-imager/core/domain/media/sync-schemas";
import { z } from "zod";
import { RemoteSyncService } from "~/application/services/remote-sync-service";

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
				return await RemoteSyncService.getMediaList(input);
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
				return await RemoteSyncService.getMediaMetadata(input);
			} catch (error) {
				throw new ORPCError("REMOTE_SYNC_ERROR", {
					message: `Failed to get media metadata from remote: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
		}),

	/**
	 * Push media to remote server
	 * Uploads media file and metadata to the remote server
	 */
	pushMedia: os
		.meta({
			openapi: {
				tags: ["Sync"],
				summary: "Push media to remote server",
				description:
					"Uploads a media file and its metadata to a remote server.",
			},
		})
		.input(pushMediaRequestSchema)
		.handler(async ({ input }) => {
			try {
				return await RemoteSyncService.pushMedia(input);
			} catch (error) {
				throw new ORPCError("REMOTE_SYNC_ERROR", {
					message: `Failed to push media to remote: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
		}),

	/**
	 * Pull media from remote server
	 * Downloads media file and metadata from the remote server
	 */
	pullMedia: os
		.meta({
			openapi: {
				tags: ["Sync"],
				summary: "Pull media from remote server",
				description:
					"Downloads a media file and its metadata from a remote server.",
			},
		})
		.input(pullMediaRequestSchema)
		.handler(async ({ input }) => {
			try {
				return await RemoteSyncService.pullMedia(input);
			} catch (error) {
				throw new ORPCError("REMOTE_SYNC_ERROR", {
					message: `Failed to pull media from remote: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
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
				return await RemoteSyncService.sync(input);
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
				return await RemoteSyncService.resolveConflict(input);
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
		.input(
			z.object({
				mediaId: z.string().uuid("Invalid media ID"),
			}),
		)
		.handler(async ({ input }) => {
			try {
				return await RemoteSyncService.getSyncStatus(input.mediaId);
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
		.input(
			z.object({
				sourceId: z.string().uuid("Invalid source ID"),
			}),
		)
		.handler(async ({ input }) => {
			try {
				return await RemoteSyncService.getSourceSyncStatus(input.sourceId);
			} catch (error) {
				throw new ORPCError("REMOTE_SYNC_ERROR", {
					message: `Failed to get source sync status: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
		}),
};
