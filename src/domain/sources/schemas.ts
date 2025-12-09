/**
 * Sources Domain Validation Schemas
 * Extracted from src/lib/schemas.ts during architecture reorganization
 */

import { z } from "zod";

export const mediaSourceIdSchema = z.uuid({
  version: "v4",
  message: "Invalid source ID format",
});
export type MedioaSourceId = z.infer<typeof mediaSourceIdSchema>;

export const localConnectionSchema = z.object({
  path: z.string().min(1, "Path is required"),
});
export type LocalConnection = z.infer<typeof localConnectionSchema>;

export const sftpConnectionSchema = z.object({
  host: z.string(),
  port: z.number().int().positive(),
  username: z.string(),
  password: z.string().optional(),
  privateKey: z.string().optional(),
  remotePath: z.string(),
});
export type SftpConnection = z.infer<typeof sftpConnectionSchema>;

export const s3ConnectionSchema = z.object({
  region: z.string(),
  bucket: z.string(),
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
  prefix: z.string().optional(),
});
export type S3Connection = z.infer<typeof s3ConnectionSchema>;

export const connectionInfoSchema = z.union([
  localConnectionSchema,
  sftpConnectionSchema,
  s3ConnectionSchema,
]);
export type ConnectionInfo = z.infer<typeof connectionInfoSchema>;

export const mediaSourceTypeEnumSchema = z.enum(["local", "sftp", "s3"]);
export type MediaSourceTypeEnum = z.infer<typeof mediaSourceTypeEnumSchema>;

export const mediaSourceInfoSchema = z.object({
  id: z.uuid({ version: "v4" }).optional(),
  name: z.string(),
  description: z.string().nullable(),
  type: mediaSourceTypeEnumSchema,
  connectionInfo: connectionInfoSchema,
});
export type MediaSourceInfo = z.infer<typeof mediaSourceInfoSchema>;

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
