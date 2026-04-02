/**
 * Remote Sync Domain Validation Schemas
 * Schemas for server-to-server media synchronization
 */

import { z } from "zod";
import { conflictTypeSchema } from "./conflict-resolution";

/**
 * Zod schema for validating sync direction.
 */
export const syncDirectionSchema = z.enum(["push", "pull", "bidirectional"]);
export type SyncDirection = z.infer<typeof syncDirectionSchema>;

/**
 * Zod schema for validating conflict resolution policy.
 */
export const conflictResolutionSchema = z.enum([
	"newer_wins",
	"local_wins",
	"remote_wins",
	"manual",
]);
export type ConflictResolution = z.infer<typeof conflictResolutionSchema>;

/**
 * Zod schema for validating remote source connection info.
 */
export const remoteSourceConnectionInfoSchema = z.object({
	/** Remote server URL (e.g., "http://192.168.1.100:3000") */
	url: z.string().url("Invalid remote server URL"),
	/** Optional port number (can be included in URL) */
	port: z.number().int().min(1).max(65535).optional(),
	/** Remote source ID on the remote server */
	remoteSourceId: z.string().uuid("Invalid remote source ID"),
});
export type RemoteSourceConnectionInfo = z.infer<
	typeof remoteSourceConnectionInfoSchema
>;

/**
 * Zod schema for validating media item for sync.
 * Represents a media item as seen by the remote server.
 */
export const remoteMediaItemSchema = z.object({
	id: z.string().uuid(),
	filePath: z.string(),
	fileName: z.string(),
	fileSize: z.number().int().positive(),
	mediaType: z.enum(["image", "video", "audio"]),
	width: z.number().int().positive(),
	height: z.number().int().positive(),
	createdAt: z.coerce.date(),
	modifiedAt: z.coerce.date(),
	hashMd5: z.string().nullable().optional(),
	description: z.string().nullable().optional(),
});
export type RemoteMediaItem = z.infer<typeof remoteMediaItemSchema>;

/**
 * Zod schema for validating media list response.
 */
export const mediaListResponseSchema = z.object({
	media: z.array(remoteMediaItemSchema),
	total: z.number().int().nonnegative(),
	hasMore: z.boolean(),
	cursor: z.string().optional(),
});
export type MediaListResponse = z.infer<typeof mediaListResponseSchema>;

/**
 * Zod schema for validating media list request.
 */
export const mediaListRequestSchema = z.object({
	sourceId: z.string().uuid("Invalid source ID"),
	cursor: z.string().optional(),
	limit: z.number().int().min(1).max(100).default(50),
});
export type MediaListRequest = z.infer<typeof mediaListRequestSchema>;

/**
 * Zod schema for validating media metadata request.
 */
export const mediaMetadataRequestSchema = z.object({
	mediaId: z.string().uuid("Invalid media ID"),
	sourceId: z.string().uuid("Invalid source ID"),
});
export type MediaMetadataRequest = z.infer<typeof mediaMetadataRequestSchema>;

/**
 * Zod schema for validating media metadata response.
 */
export const mediaMetadataResponseSchema = z.object({
	media: remoteMediaItemSchema,
	tags: z.array(
		z.object({
			id: z.string().uuid(),
			name: z.string(),
			category: z.string().nullable().optional(),
		}),
	),
	generationInfo: z
		.object({
			prompt: z.string().nullable().optional(),
			negativePrompt: z.string().nullable().optional(),
			workflow: z.string().nullable().optional(),
			model: z.string().nullable().optional(),
			sampler: z.string().nullable().optional(),
			steps: z.number().int().nullable().optional(),
			cfgScale: z.number().nullable().optional(),
			seed: z.number().int().nullable().optional(),
			size: z.string().nullable().optional(),
		})
		.nullable()
		.optional(),
});
export type MediaMetadataResponse = z.infer<typeof mediaMetadataResponseSchema>;

/**
 * Zod schema for validating push media request.
 */
export const pushMediaRequestSchema = z.object({
	mediaId: z.string().uuid("Invalid media ID"),
	targetSourceId: z.string().uuid("Invalid target source ID"),
	includeMetadata: z.boolean().default(true),
	conflictResolution: conflictResolutionSchema.default("newer_wins"),
});
export type PushMediaRequest = z.infer<typeof pushMediaRequestSchema>;

/**
 * Zod schema for validating push media response.
 */
export const pushMediaResponseSchema = z.object({
	success: z.boolean(),
	remoteMediaId: z.string().uuid().optional(),
	conflict: z.boolean().default(false),
	conflictDetails: z
		.object({
			localMediaId: z.string().uuid(),
			remoteMediaId: z.string().uuid(),
			localModifiedAt: z.coerce.date(),
			remoteModifiedAt: z.coerce.date(),
		})
		.optional(),
	error: z.string().optional(),
});
export type PushMediaResponse = z.infer<typeof pushMediaResponseSchema>;

/**
 * Zod schema for validating pull media request.
 */
export const pullMediaRequestSchema = z.object({
	remoteMediaId: z.string().uuid("Invalid remote media ID"),
	targetSourceId: z.string().uuid("Invalid target source ID"),
	includeMetadata: z.boolean().default(true),
	conflictResolution: conflictResolutionSchema.default("newer_wins"),
});
export type PullMediaRequest = z.infer<typeof pullMediaRequestSchema>;

/**
 * Zod schema for validating pull media response.
 */
export const pullMediaResponseSchema = z.object({
	success: z.boolean(),
	localMediaId: z.string().uuid().optional(),
	conflict: z.boolean().default(false),
	conflictDetails: z
		.object({
			localMediaId: z.string().uuid(),
			remoteMediaId: z.string().uuid(),
			localModifiedAt: z.coerce.date(),
			remoteModifiedAt: z.coerce.date(),
		})
		.optional(),
	error: z.string().optional(),
});
export type PullMediaResponse = z.infer<typeof pullMediaResponseSchema>;

/**
 * Zod schema for validating sync request.
 */
export const syncRequestSchema = z.object({
	localSourceId: z.string().uuid("Invalid local source ID"),
	remoteSourceId: z.string().uuid("Invalid remote source ID"),
	direction: syncDirectionSchema.default("bidirectional"),
	conflictResolution: conflictResolutionSchema.default("newer_wins"),
	dryRun: z.boolean().default(false),
});
export type SyncRequest = z.infer<typeof syncRequestSchema>;

/**
 * Zod schema for validating sync response.
 */
export const syncResponseSchema = z.object({
	success: z.boolean(),
	stats: z.object({
		totalMedia: z.number().int().nonnegative(),
		pushed: z.number().int().nonnegative(),
		pulled: z.number().int().nonnegative(),
		conflicts: z.number().int().nonnegative(),
		errors: z.number().int().nonnegative(),
	}),
	conflicts: z.array(
		z.object({
			localMediaId: z.string().uuid(),
			remoteMediaId: z.string().uuid(),
			localModifiedAt: z.coerce.date(),
			remoteModifiedAt: z.coerce.date(),
			resolved: z.boolean(),
			resolution: conflictResolutionSchema.optional(),
		}),
	),
	errors: z.array(
		z.object({
			mediaId: z.string().uuid(),
			error: z.string(),
		}),
	),
});
export type SyncResponse = z.infer<typeof syncResponseSchema>;

export const syncConflictSummarySchema = z.object({
	id: z.string(),
	localMediaId: z.string().uuid(),
	remoteMediaId: z.string().uuid(),
	localFilePath: z.string(),
	remoteFilePath: z.string(),
	localModifiedAt: z.coerce.date(),
	remoteModifiedAt: z.coerce.date(),
	conflictType: conflictTypeSchema,
});
export type SyncConflictSummary = z.infer<typeof syncConflictSummarySchema>;

export const getSyncStatusRequestSchema = z.object({
	mediaId: z.string().uuid("Invalid media ID"),
	remoteSourceId: z.string().uuid("Invalid remote source ID"),
});
export type GetSyncStatusRequest = z.infer<typeof getSyncStatusRequestSchema>;

export const syncItemStatusSchema = z.enum([
	"synced",
	"local_only",
	"remote_only",
	"conflict",
	"not_found",
]);
export type SyncItemStatus = z.infer<typeof syncItemStatusSchema>;

export const getSyncStatusResponseSchema = z.object({
	mediaId: z.string().uuid(),
	status: syncItemStatusSchema,
	conflict: syncConflictSummarySchema.optional(),
});
export type GetSyncStatusResponse = z.infer<typeof getSyncStatusResponseSchema>;

export const getSourceSyncStatusRequestSchema = z.object({
	sourceId: z.string().uuid("Invalid source ID"),
	remoteSourceId: z.string().uuid("Invalid remote source ID"),
});
export type GetSourceSyncStatusRequest = z.infer<
	typeof getSourceSyncStatusRequestSchema
>;

export const getSourceSyncStatusResponseSchema = z.object({
	totalMedia: z.number().int().nonnegative(),
	synced: z.number().int().nonnegative(),
	pending: z.number().int().nonnegative(),
	failed: z.number().int().nonnegative(),
	conflicts: z.array(syncConflictSummarySchema),
});
export type GetSourceSyncStatusResponse = z.infer<
	typeof getSourceSyncStatusResponseSchema
>;

/**
 * Zod schema for validating conflict resolution request.
 */
export const conflictResolutionRequestSchema = z.object({
	localMediaId: z.string().uuid("Invalid local media ID"),
	remoteMediaId: z.string().uuid("Invalid remote media ID"),
	resolution: conflictResolutionSchema,
	remoteSourceId: z.string().uuid("Invalid remote source ID"),
});
export type ConflictResolutionRequest = z.infer<
	typeof conflictResolutionRequestSchema
>;

/**
 * Zod schema for validating conflict resolution response.
 */
export const conflictResolutionResponseSchema = z.object({
	success: z.boolean(),
	resolvedMediaId: z.string().uuid().optional(),
	error: z.string().optional(),
});
export type ConflictResolutionResponse = z.infer<
	typeof conflictResolutionResponseSchema
>;

// ============================================================================
// Sync Media Transfer Schemas
// Full metadata context for server-to-server sync (aligned with MediaMetadataContext)
// ============================================================================

const syncMetadataFields = {
	description: z.string().nullable().optional(),
	createdAt: z.coerce.date().optional(),
	sourceUrls: z.array(z.string().url()).optional(),
	authors: z
		.array(
			z.object({
				name: z.string(),
				accountId: z.string().nullable().optional(),
			}),
		)
		.optional(),
	tags: z
		.array(
			z.object({
				name: z.string(),
				type: z.enum(["positive", "negative"]).optional(),
				confidence: z.number().nullable().optional(),
			}),
		)
		.optional(),
	characters: z
		.array(
			z.object({
				name: z.string(),
				confidence: z.number().nullable().optional(),
				linkedIps: z.array(z.string()).optional(),
			}),
		)
		.optional(),
	ips: z
		.array(
			z.object({
				name: z.string(),
				confidence: z.number().nullable().optional(),
			}),
		)
		.optional(),
	projects: z
		.array(
			z.object({
				name: z.string(),
				description: z.string().nullable().optional(),
			}),
		)
		.optional(),
	generationInfo: z
		.object({
			prompt: z.string().nullable().optional(),
			negativePrompt: z.string().nullable().optional(),
			modelName: z.string().optional(),
			seed: z.number().optional(),
			steps: z.number().optional(),
			cfgScale: z.number().optional(),
			aiGenerated: z.boolean().optional(),
		})
		.nullable()
		.optional(),
} as const;

/**
 * Zod schema for pushing a media file with full metadata.
 * Used by BidirectionalSyncServiceImpl to transfer media to a remote server.
 */
export const pushMediaFileRequestSchema = z.object({
	file: z.instanceof(File),
	targetSourceId: z.string().uuid("Invalid target source ID"),
	fileName: z.string().optional(),
	...syncMetadataFields,
});
export type PushMediaFileRequest = z.infer<typeof pushMediaFileRequestSchema>;

/**
 * Zod schema for the push media file response.
 */
export const pushMediaFileResponseSchema = z.object({
	success: z.boolean(),
	mediaId: z.string().uuid().optional(),
	error: z.string().optional(),
});
export type PushMediaFileResponse = z.infer<typeof pushMediaFileResponseSchema>;

/**
 * Zod schema for pulling a media file with full metadata.
 * Used by BidirectionalSyncServiceImpl to retrieve media from a remote server.
 */
export const pullMediaFileRequestSchema = z.object({
	mediaId: z.string().uuid("Invalid media ID"),
	sourceId: z.string().uuid("Invalid source ID"),
});
export type PullMediaFileRequest = z.infer<typeof pullMediaFileRequestSchema>;

/**
 * Zod schema for the pull media file response.
 * Returns base64-encoded file data and full metadata.
 */
export const pullMediaFileResponseSchema = z.object({
	success: z.boolean(),
	fileData: z.string().optional(),
	fileName: z.string().optional(),
	mimeType: z.string().optional(),
	error: z.string().optional(),
	...syncMetadataFields,
});
export type PullMediaFileResponse = z.infer<typeof pullMediaFileResponseSchema>;
