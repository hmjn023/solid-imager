/**
 * Sources Domain Validation Schemas
 * Extracted from src/lib/schemas.ts during architecture reorganization
 */

import { z } from "zod";

export const mediaSourceIdSchema = z.uuid({
	message: "Invalid source ID format",
});
export type MedioaSourceId = z.infer<typeof mediaSourceIdSchema>;

/** Connection settings for a local filesystem source. */
export const localConnectionSchema = z.object({
	path: z.string().min(1, "Path is required"),
});
export type LocalConnection = z.infer<typeof localConnectionSchema>;

/** Connection settings for an SFTP source, potentially including credentials. */
export const sftpConnectionSchema = z.object({
	host: z.string(),
	port: z.number().int().positive(),
	username: z.string(),
	password: z.string().optional(),
	privateKey: z.string().optional(),
	remotePath: z.string(),
});
export type SftpConnection = z.infer<typeof sftpConnectionSchema>;

/** Connection settings for an S3 source, potentially including credentials. */
export const s3ConnectionSchema = z.object({
	region: z.string(),
	bucket: z.string(),
	accessKeyId: z.string(),
	secretAccessKey: z.string(),
	prefix: z.string().optional(),
});
export type S3Connection = z.infer<typeof s3ConnectionSchema>;

/** Supported source connection settings; may contain sensitive credentials. */
export const connectionInfoSchema = z.union([
	localConnectionSchema,
	sftpConnectionSchema,
	s3ConnectionSchema,
]);
export type ConnectionInfo = z.infer<typeof connectionInfoSchema>;

export const mediaSourceTypeEnumSchema = z.enum(["local", "sftp", "s3"]);
export type MediaSourceTypeEnum = z.infer<typeof mediaSourceTypeEnumSchema>;

/** Synchronization state reported for a media source. */
export const mediaSourceSyncStateSchema = z.enum(["idle", "syncing", "error"]);
export type MediaSourceSyncState = z.infer<typeof mediaSourceSyncStateSchema>;

const directorySyncCountsSchema = z.object({
	sourceId: z.uuid(),
	added: z.number().int().nonnegative(),
	deleted: z.number().int().nonnegative(),
	failed: z.number().int().nonnegative(),
});

/** Final outcome of one directory scan, including committed work on partial failure. */
export const directorySyncResultSchema = z.discriminatedUnion("success", [
	directorySyncCountsSchema.extend({ success: z.literal(true) }),
	directorySyncCountsSchema.extend({
		success: z.literal(false),
		error: z.string(),
		// Partial: traversal finished and its outcome was saved; only individual
		// files failed. Fatal: synchronization could not be safely initialized/finalized.
		failureKind: z.enum(["partial", "fatal"]),
	}),
]);
export type DirectorySyncResult = z.infer<typeof directorySyncResultSchema>;

/** Source information and its current synchronization state. */
export const mediaSourceInfoSchema = z.object({
	id: z.uuid().optional(),
	name: z.string(),
	description: z.string().nullable(),
	type: mediaSourceTypeEnumSchema,
	connectionInfo: connectionInfoSchema,
});
export type MediaSourceInfo = z.infer<typeof mediaSourceInfoSchema>;

/** File system change observed for a media source. */
export const fileSystemEventSchema = z.object({
	type: z.enum(["added", "deleted", "modified"]),
	mediaSourceId: z.string(),
	filePath: z.string(),
	timestamp: z.coerce.date(),
});
export type FileSystemEvent = z.infer<typeof fileSystemEventSchema>;

export const createDirectoryRequestSchema = z.object({
	path: z.string(),
	name: z.string(),
	recursive: z.boolean().optional(),
});
export type CreateDirectoryRequest = z.infer<
	typeof createDirectoryRequestSchema
>;

export const deleteDirectoryRequestSchema = z.object({
	path: z.string(),
	force: z.boolean().optional(),
});
export type DeleteDirectoryRequest = z.infer<
	typeof deleteDirectoryRequestSchema
>;

export const updateDirectoryRequestSchema = z.object({
	oldPath: z.string(),
	newPath: z.string(),
});
export type UpdateDirectoryRequest = z.infer<
	typeof updateDirectoryRequestSchema
>;

export const cloneSourceRequestSchema = z.object({
	newName: z.string(),
});
export type CloneSourceRequest = z.infer<typeof cloneSourceRequestSchema>;

// Safe schemas for API responses (masking secrets)
export const safeSftpConnectionSchema = sftpConnectionSchema.omit({
	password: true,
	privateKey: true,
});

export const safeS3ConnectionSchema = s3ConnectionSchema.omit({
	accessKeyId: true,
	secretAccessKey: true,
});

export const safeConnectionInfoSchema = z.union([
	localConnectionSchema,
	safeSftpConnectionSchema,
	safeS3ConnectionSchema,
]);

export const safeMediaSourceSchema = mediaSourceInfoSchema.extend({
	connectionInfo: safeConnectionInfoSchema,
	mediaCount: z.number().int().nonnegative().optional(),
	syncStatus: mediaSourceSyncStateSchema.optional(),
	lastSyncStartedAt: z.coerce.date().nullable().optional(),
	lastSyncCompletedAt: z.coerce.date().nullable().optional(),
	lastSyncError: z.string().nullable().optional(),
});

export type SafeMediaSource = z.infer<typeof safeMediaSourceSchema>;

export const mediaSourceStatusSchema = z.object({
	mediaSourceId: z.uuid(),
	status: z.enum(["active", "error"]),
	message: z.string().optional(),
	lastChecked: z.coerce.date(),
});
export type MediaSourceStatus = z.infer<typeof mediaSourceStatusSchema>;
