/**
 * Media Domain Validation Schemas
 * Extracted from src/lib/schemas.ts during architecture reorganization
 */

import { z } from "zod";

/**
 * Zod schema for validating media types.
 * Allowed values are "image", "video", and "audio".
 */
export const mediaTypeSchema = z.enum(["image", "video", "audio"]);
export type MediaType = z.infer<typeof mediaTypeSchema>;

/**
 * Zod schema for validating the request body when adding new media.
 * Ensures all required fields for new media are present and correctly formatted.
 */
export const addMediaRequestSchema = z.object({
  mediaSourceId: z.uuid({ version: "v4", message: "Invalid source ID format" }),
  filePath: z.string().min(1, "File path is required"),
  fileName: z.string().min(1, "File name is required"),
  size: z.number().int().positive("File size must be a positive integer"),
  createdAt: z.coerce.date().optional(),
  modifiedAt: z.coerce.date().optional(),
  mediaType: mediaTypeSchema,
  description: z.string().nullable(),
  sourceUrls: z.array(z.string().url()).optional(),
  width: z.number().int().positive("Width must be a positive integer"),
  height: z.number().int().positive("Height must be a positive integer"),
});
export type AddMediaRequest = z.infer<typeof addMediaRequestSchema>;

export const imageMetadataCommentSchema = z.object({
  keyword: z.string().min(1, "keyword is required"),
  text: z.string().min(1, "keyword is required"),
});

export type ImageMetadataComment = z.infer<typeof imageMetadataCommentSchema>;

/**
 * Zod schema for validating the request body when updating existing media.
 * All fields are optional, allowing partial updates.
 */
export const updateMediaRequestSchema = z.object({
  filePath: z.string().min(1, "File path cannot be empty").optional(),
  fileName: z.string().min(1, "File name cannot be empty").optional(),
  size: z
    .number()
    .int()
    .positive("File size must be a positive integer")
    .optional(),
  createdAt: z.coerce.date().optional(),
  modifiedAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(), // Keeping updatedAt for BC if needed, but modifiedAt is primary
  mediaType: mediaTypeSchema.optional(),
  width: z
    .number()
    .int()
    .positive("Width must be a positive integer")
    .optional(),
  height: z
    .number()
    .int()
    .positive("Height must be a positive integer")
    .optional(),
  description: z.string().nullable().optional(),
  sourceUrls: z.array(z.string().url("Invalid URL format")).optional(),
  authors: z
    .array(
      z.object({
        name: z.string(),
        accountId: z.string().optional().nullable(),
      })
    )
    .optional(),
});
export type UpdateMediaRequest = z.infer<typeof updateMediaRequestSchema>;

/**
 * Zod schema for validating a media ID.
 * Ensures the ID is a valid UUID format.
 */
export const mediaIdSchema = z.uuid({
  version: "v4",
  message: "Invalid media ID format",
});
export type MediaId = z.infer<typeof mediaIdSchema>;

/**
 * Zod schema for validating a source ID.
 * Ensures the ID is a valid UUID format.
 */
export const mediaSourceIdSchema = z.uuid({
  version: "v4",
  message: "Invalid source ID format",
});
export type SourceId = z.infer<typeof mediaSourceIdSchema>;

/**
 * Zod schema for validating a directory path.
 * Ensures the path is a non-empty string.
 */
export const directoryPathSchema = z
  .string()
  .min(1, "Directory path is required");
export type DirectoryPath = z.infer<typeof directoryPathSchema>;

export const extractedDataSchema = z.object({
  tags: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["positive", "negative"]),
    })
  ),
  prompt: z.any().nullable(),
  workflow: z.any().nullable(),
});

export type ExtractedData = z.infer<typeof extractedDataSchema>;

// Base schemas mirroring database tables
export const mediaSchema = z.object({
  id: z.uuid({ version: "v4" }),
  mediaSourceId: z.uuid({ version: "v4" }),
  filePath: z.string(),
  fileName: z.string(),
  mediaType: mediaTypeSchema,
  width: z.number(),
  height: z.number(),
  fileSize: z.number().nullable(),
  description: z.string().nullable(),
  createdAt: z.coerce.date(),
  modifiedAt: z.coerce.date(),
  indexedAt: z.coerce.date(),
  status: z.enum(["active", "archived", "deleted"]),
});

export type Media = z.infer<typeof mediaSchema>;

export const authorSchema = z.object({
  id: z.uuid({ version: "v4" }),
  name: z.string(),
  accountId: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Author = z.infer<typeof authorSchema>;

export const newAuthorSchema = z.object({
  name: z.string(),
  accountId: z.string().nullable().optional(),
});

export type NewAuthor = z.infer<typeof newAuthorSchema>;

export const mediaUrlSchema = z.object({
  id: z.uuid({ version: "v4" }),
  mediaId: z.uuid({ version: "v4" }),
  url: z.string().url(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type MediaUrl = z.infer<typeof mediaUrlSchema>;

export const tagSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  attribute: z.string().nullable(),
  color: z.string().nullable(),
  source: z.string(),
  authorId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  type: z.enum(["positive", "negative"]), // from mediaTags
});

export const mediaGenerationInfoSchema = z.object({
  mediaId: z.uuid({ version: "v4" }),
  metadata: z.any().nullable(),
  prompt: z.string().nullable(),
  negativePrompt: z.string().nullable(),
  workflow: z.any().nullable(),
  loras: z.any().nullable(),
  vae: z.string().nullable(),
  hypernetworks: z.any().nullable(),
  embeddings: z.any().nullable(),
  aiGenerated: z.boolean(),
  modelName: z.string(),
  seed: z.number(),
  cfgScale: z.number(),
  steps: z.number(),
});

// Search schemas
export const mediaSearchRequestSchema = z.object({
  q: z.string().optional(),
  tags: z.string().optional(), // comma-separated tag names
  tagMode: z.enum(["and", "or"]).default("and"),
  excludeTags: z.string().optional(), // comma-separated tag names
  projects: z.string().optional(), // comma-separated project IDs
  ips: z.string().optional(), // comma-separated IP IDs
  characters: z.string().optional(), // comma-separated character IDs
  sort: z.enum(["date", "name", "size"]).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  limit: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type MediaSearchRequest = z.infer<typeof mediaSearchRequestSchema>;

export const mediaSearchResponseSchema = z.object({
  media: z.array(mediaSchema),
  total: z.number(),
});

export type MediaSearchResponse = z.infer<typeof mediaSearchResponseSchema>;

// Combined schema for the details endpoint
export const mediaDetailsSchema = mediaSchema.extend({
  tags: z.array(tagSchema),
  generationInfo: mediaGenerationInfoSchema.nullable(),
  authors: z.array(authorSchema),
  urls: z.array(mediaUrlSchema),
});

export type MediaDetails = z.infer<typeof mediaDetailsSchema>;

// Download schemas for bulk image download from JSON
export const downloadItemSchema = z.object({
  imageUrl: z.string().url("Invalid image URL"),
  tweetUrl: z.string().url("Invalid tweet URL").optional(),
  tweetText: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  authorName: z.string().optional(),
  authorId: z.string().optional(),
});

export type DownloadItem = z.infer<typeof downloadItemSchema>;

export const bulkDownloadRequestSchema = z.object({
  mediaSourceId: z.uuid({ version: "v4", message: "Invalid media source ID" }),
  items: z.array(downloadItemSchema).min(1, "At least one item is required"),
});

export type BulkDownloadRequest = z.infer<typeof bulkDownloadRequestSchema>;

export const bulkDownloadResponseSchema = z.object({
  success: z.boolean(),
  jobCount: z.number(),
  message: z.string(),
});

export type BulkDownloadResponse = z.infer<typeof bulkDownloadResponseSchema>;

// biome-ignore lint/performance/noBarrelFile: Re-exporting for convenience and to resolve bundling issues.
export {
  type Conflict,
  conflictSchema,
  type UploadMediaRequest,
  type UploadResponse,
  uploadMediaRequestSchema,
  uploadResponseSchema,
} from "./upload-schemas";

export const copyMediaRequestSchema = z.object({
  targetSourceId: z.uuid({
    version: "v4",
    message: "Invalid target source ID",
  }),
});

export type CopyMediaRequest = z.infer<typeof copyMediaRequestSchema>;

export const moveMediaRequestSchema = copyMediaRequestSchema;

export type MoveMediaRequest = z.infer<typeof moveMediaRequestSchema>;
