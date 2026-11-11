/**
 * Media Domain Validation Schemas
 * Extracted from src/lib/schemas.ts during architecture reorganization
 */

import { z } from "zod";
import { authorSchema, newAuthorSchema } from "../authors/schemas";
import { mediaSortSchema } from "../search/sort";
import { searchGroupSchema } from "../search/criteria";
import { workflowSchema } from "../tags/schemas";
import { ugoiraMetadataSchema } from "./ugoira-schemas";

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
	mediaSourceId: z.uuid({ message: "Invalid source ID format" }),
	filePath: z.string().min(1, "File path is required"),
	fileName: z.string().min(1, "File name is required"),
	fileSize: z.number().int().positive("File size must be a positive integer"),
	createdAt: z.coerce.date().optional(),
	modifiedAt: z.coerce.date().optional(),
	mediaType: mediaTypeSchema,
	description: z.string().nullable(),
	sourceUrls: z.array(z.url()).optional(),
	width: z.number().int().positive("Width must be a positive integer"),
	height: z.number().int().positive("Height must be a positive integer"),
});
export type AddMediaRequest = z.infer<typeof addMediaRequestSchema>;

/** A named text entry extracted from image metadata. */
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
	fileSize: z
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
	sourceUrls: z.array(z.url("Invalid URL format")).optional(),
	authors: z.array(newAuthorSchema).optional(),
	characters: z
		.array(
			z.object({
				name: z.string(),
				confidence: z.number().nullable().optional(),
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
});
export type UpdateMediaRequestInput = z.input<typeof updateMediaRequestSchema>;
export type UpdateMediaRequest = z.infer<typeof updateMediaRequestSchema>;

/**
 * Zod schema for validating a media ID.
 * Ensures the ID is a valid UUID format.
 */
export const mediaIdSchema = z.uuid({
	message: "Invalid media ID format",
});
export type MediaId = z.infer<typeof mediaIdSchema>;

/**
 * Zod schema for validating a source ID.
 * Ensures the ID is a valid UUID format.
 */
export const mediaSourceIdSchema = z.uuid({
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

/** Tags, prompt, and workflow extracted from a media file. */
export const extractedDataSchema = z.object({
	tags: z.array(
		z.object({
			name: z.string(),
			type: z.enum(["positive", "negative"]),
		}),
	),
	prompt: z.string().nullable(),
	workflow: workflowSchema.nullable(),
});

export type ExtractedData = z.infer<typeof extractedDataSchema>;

// Base schemas mirroring database tables
/** Associates a media item with its source. */
export const mediaLocationSchema = z.object({
	sourceId: z.uuid(),
	mediaId: z.uuid(),
});

/** Internal media record, including its source-relative file path. */
export const mediaSchema = z.object({
	id: z.uuid(),
	mediaSourceId: z.uuid(),
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

/** Client-facing media fields; excludes the internal file path. */
export const mediaSafeSchema = mediaSchema.pick({
	id: true,
	mediaSourceId: true,
	fileName: true,
	mediaType: true,
	width: true,
	height: true,
	fileSize: true,
	description: true,
	createdAt: true,
	modifiedAt: true,
	indexedAt: true,
	status: true,
});
export type MediaSafe = z.infer<typeof mediaSafeSchema>;

/** Why an image is recommended alongside the current media. */
export const relatedMediaReasonSchema = z.enum([
	"similar",
	"character",
	"ip",
	"tag",
]);
export type RelatedMediaReason = z.infer<typeof relatedMediaReasonSchema>;

/** Limit applies separately to recommendations and each category. */
export const relatedMediaRequestSchema = mediaLocationSchema.extend({
	limit: z.number().int().min(1).max(24).default(12),
	seed: z.string().min(1).max(128).default("default"),
});
export type RelatedMediaRequest = z.infer<typeof relatedMediaRequestSchema>;
export type RelatedMediaRequestInput = z.input<
	typeof relatedMediaRequestSchema
>;

export const relatedMediaItemSchema = z.object({
	media: mediaSafeSchema,
	reasons: z.array(relatedMediaReasonSchema).min(1),
});
export type RelatedMediaItem = z.infer<typeof relatedMediaItemSchema>;

/** Category results retain their ranking; recommendations are sampled independently. */
export const relatedMediaResponseSchema = z.object({
	items: z.array(relatedMediaItemSchema),
	recommendations: z.array(relatedMediaItemSchema),
	similarityStatus: z.enum(["available", "not_indexed", "unavailable"]),
});
export type RelatedMediaResponse = z.infer<typeof relatedMediaResponseSchema>;

/** Internal scored tag candidate; paths stay inside the application boundary. */
export const relatedMediaTagCandidateSchema = z.object({
	media: mediaSchema,
	score: z.number().min(0).max(1),
});
export type RelatedMediaTagCandidate = z.infer<
	typeof relatedMediaTagCandidateSchema
>;

/** Bounded candidate metadata used to avoid repetitive recommendations. */
export const relatedMediaSignalsSchema = z.object({
	mediaId: z.uuid(),
	authorIds: z.array(z.uuid()),
	tagIds: z.array(z.uuid()),
});
export type RelatedMediaSignals = z.infer<typeof relatedMediaSignalsSchema>;

export const mediaUrlSchema = z.object({
	id: z.uuid(),
	mediaId: z.uuid(),
	url: z.url(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type MediaUrl = z.infer<typeof mediaUrlSchema>;

export const tagSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	description: z.string().nullable(),
	attribute: z.string().nullable(),
	color: z.string().nullable(),
	source: z.string(),
	authorId: z.uuid().nullable().optional(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	type: z.enum(["positive", "negative"]), // from mediaTags
	confidence: z.number().nullable().optional(), // from mediaTags
});
// ...existing code...
export type MediaTag = z.infer<typeof tagSchema>;

export const characterSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	description: z.string().nullable(),
	source: z.string(),
	aliases: z.any().nullable().optional(), // jsonb
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	confidence: z.number().nullable().optional(), // from mediaCharacters
	linkSource: z.string().optional(), // from mediaCharacters source
});
export type MediaCharacter = z.infer<typeof characterSchema>;

export const ipSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	description: z.string().nullable(),
	source: z.string(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	confidence: z.number().nullable().optional(), // from mediaIps
	linkSource: z.string().optional(), // from mediaIps source
});
export type MediaIp = z.infer<typeof ipSchema>;

/** Generation parameters and metadata associated with a media item. */
export const mediaGenerationInfoSchema = z.object({
	mediaId: z.uuid(),
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
export type MediaGenerationInfo = z.infer<typeof mediaGenerationInfoSchema>;

/** Search conditions and pagination; offset defaults to zero and order to descending. */
export const mediaSearchRequestSchema = z.object({
	condition: searchGroupSchema.optional(),
	sort: mediaSortSchema.optional(),
	order: z.enum(["asc", "desc"]).default("desc"),
	limit: z.coerce.number().int().positive().optional(),
	offset: z.coerce.number().int().nonnegative().default(0),
});

export type MediaSearchRequestInput = z.input<typeof mediaSearchRequestSchema>;
export type MediaSearchRequest = z.infer<typeof mediaSearchRequestSchema>;

/** Search results and the total number of matching media items. */
export const mediaSearchResponseSchema = z.object({
	media: z.array(mediaSchema),
	total: z.number(),
});

export type MediaSearchResponse = z.infer<typeof mediaSearchResponseSchema>;

/** Search results with cosine distances keyed by media ID. */
export const similarMediaSearchResponseSchema = z.object({
	media: z.array(mediaSchema),
	total: z.number(),
	scores: z.array(
		z.object({
			mediaId: z.uuid(),
			cosineDistance: z.number(),
		}),
	),
});

export type SimilarMediaSearchResponse = z.infer<
	typeof similarMediaSearchResponseSchema
>;

const mediaRatingSchema = z.number().int().min(0).max(5);

/** Partial preference update requiring rating (an integer from 0 to 5), favorite, or both. */
export const mediaPreferencesPatchSchema = z
	.object({
		rating: mediaRatingSchema.optional(),
		favorite: z.boolean().optional(),
	})
	.refine(
		(patch) => patch.rating !== undefined || patch.favorite !== undefined,
		{
			message: "Specify rating or favorite",
		},
	);
export type MediaPreferencesPatch = z.infer<typeof mediaPreferencesPatchSchema>;

/** Per-media preference and view activity, including the last viewed time. */
export const mediaActivitySchema = z.object({
	rating: mediaRatingSchema,
	favorite: z.boolean(),
	viewCount: z.number().int().nonnegative(),
	lastViewedAt: z.coerce.date().nullable(),
});
export type MediaActivity = z.infer<typeof mediaActivitySchema>;

// Combined schema for the details endpoint
/** Media record with activity, generation information and associated entities. */
export const mediaDetailsSchema = mediaSchema.extend({
	activity: mediaActivitySchema,
	tags: z.array(tagSchema),
	generationInfo: mediaGenerationInfoSchema.nullable(),
	authors: z.array(authorSchema),
	urls: z.array(mediaUrlSchema),
	characters: z.array(characterSchema),
	ips: z.array(ipSchema),
});

export type MediaDetails = z.infer<typeof mediaDetailsSchema>;

// ============================================================================
// Base Schema: MediaMetadataContext
// Pure metadata without file information. Used as common interface for
// MediaProcessingService across all media registration flows.
// ============================================================================

/**
 * Base schema for media metadata context.
 * Contains only relational/contextual data, no physical file information.
 * This is the common interface used by MediaProcessingService.
 */
export const mediaMetadataContextSchema = z.object({
	description: z.string().nullable().optional(),
	createdAt: z
		.union([z.literal("").transform(() => undefined), z.coerce.date()])
		.optional(), // Original creation date (e.g., from social media post)
	sourceUrls: z
		.preprocess(
			(val) =>
				Array.isArray(val)
					? val.flatMap((v: unknown) => {
							if (typeof v === "string" && /^https?:\/\/.+/.test(v)) return [v];
							return [];
						})
					: val,
			z.array(z.url()),
		)
		.optional(),
	authors: z.array(newAuthorSchema).optional(),
	tags: z
		.array(
			z.object({
				name: z.string(),
				type: z.enum(["positive", "negative"]).optional(),
				confidence: z.number().nullable().optional(),
				source: z.string().optional(),
			}),
		)
		.optional(),
	characters: z
		.array(
			z.object({
				name: z.string(),
				description: z.string().nullable().optional(),
				confidence: z.number().nullable().optional(),
				linkedIps: z.array(z.string()).optional(),
				source: z.string().optional(),
			}),
		)
		.optional(),
	ips: z
		.array(
			z.object({
				name: z.string(),
				description: z.string().nullable().optional(),
				confidence: z.number().nullable().optional(),
				source: z.string().optional(),
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
			workflow: z.any().nullable().optional(),
			metadata: z.any().nullable().optional(),
		})
		.nullable()
		.optional(),
});

export type MediaMetadataContext = z.infer<typeof mediaMetadataContextSchema>;

// ============================================================================
// Backup/Restore Schema: MediaDumpItem
// Extends MediaMetadataContext with physical file information.
// ============================================================================

/**
 * Schema representing a single item in the backup dump.
 * Extends MediaMetadataContext with file-specific information.
 */
export const mediaDumpItemSchema = mediaMetadataContextSchema.extend({
	// Basic file info (ignored/generated on import for most fields)
	id: z.string().optional(),
	filePath: z.string().optional(),
	fileName: z.string().optional(),
	width: z.number().optional(),
	height: z.number().optional(),
	fileSize: z.number().optional(),
	mediaType: z.enum(["image", "video", "audio"]).optional(),
	createdAt: z.coerce.date().optional(),
	modifiedAt: z.coerce.date().optional(),
	indexedAt: z.coerce.date().nullish(),
});

export type MediaDumpItem = z.infer<typeof mediaDumpItemSchema>;

/**
 * Schema for items to be downloaded via the xtracter extension.
 * Extends the dump schema with download-specific technical fields.
 */
export const downloadItemSchema = mediaMetadataContextSchema.extend({
	// Specific required fields for download
	// Optional because restore items (from backup) might not have it,
	// but required for actual download jobs (validated in handler).
	targetUrl: z.url("Invalid target URL").optional(),

	// Restore fields
	filePath: z.string().optional(),
	fileName: z.string().optional(),

	// Technical options
	cookies: z.array(z.any()).optional(),
	userAgent: z.string().optional(),
	ugoira: ugoiraMetadataSchema.optional(),
});

export type DownloadItem = z.infer<typeof downloadItemSchema>;

/** A queued import item, its creation time and optional target source. */
export const pendingImportJobSchema = z.object({
	id: z.string(),
	item: downloadItemSchema,
	createdAt: z.coerce.date(),
	targetSourceId: z.string().optional(),
});

export type PendingImportJob = z.infer<typeof pendingImportJobSchema>;

export const pendingImportCountSchema = z.object({
	count: z.number().int().nonnegative(),
});

export type PendingImportCount = z.infer<typeof pendingImportCountSchema>;

/** Submits one or more download items to a target source. */
export const bulkDownloadRequestSchema = z.object({
	mediaSourceId: z.uuid({ message: "Invalid media source ID" }),
	items: z.array(downloadItemSchema).min(1, "At least one item is required"),
});

export type BulkDownloadRequest = z.infer<typeof bulkDownloadRequestSchema>;

export const bulkDownloadResponseSchema = z.object({
	success: z.boolean(),
	jobCount: z.number(),
	message: z.string(),
});

export type BulkDownloadResponse = z.infer<typeof bulkDownloadResponseSchema>;

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
		message: "Invalid target source ID",
	}),
});

export type CopyMediaRequest = z.infer<typeof copyMediaRequestSchema>;

export const moveMediaRequestSchema = copyMediaRequestSchema;

export type MoveMediaRequest = z.infer<typeof moveMediaRequestSchema>;

// ============================================================================
// Duplicate Detection Schemas
// ============================================================================

export const duplicateReasonSchema = z.enum(["sourceUrl"]);
export type DuplicateReason = z.infer<typeof duplicateReasonSchema>;

export const duplicateMediaItemSchema = z.object({
	id: z.uuid(),
	mediaSourceId: z.uuid(),
	fileName: z.string(),
	filePath: z.string(),
	fileSize: z.number().nullable(),
	width: z.number(),
	height: z.number(),
	mediaType: z.enum(["image", "video", "audio"]),
	createdAt: z.coerce.date(),
	modifiedAt: z.coerce.date(),
	sourceUrls: z.array(z.url()),
});
export type DuplicateMediaItem = z.infer<typeof duplicateMediaItemSchema>;

/** Media grouped by a shared duplicate reason. */
export const duplicateGroupSchema = z.object({
	id: z.string(),
	reason: duplicateReasonSchema,
	media: z.array(duplicateMediaItemSchema),
});
export type DuplicateGroup = z.infer<typeof duplicateGroupSchema>;

export const findDuplicatesResponseSchema = z.object({
	groups: z.array(duplicateGroupSchema),
});
export type FindDuplicatesResponse = z.infer<
	typeof findDuplicatesResponseSchema
>;

/** Duplicate search, optionally restricted to a single source. */
export const findDuplicatesRequestSchema = z.object({
	mediaSourceId: z.uuid().optional(),
});
export type FindDuplicatesRequest = z.infer<typeof findDuplicatesRequestSchema>;

/** Applies a partial update to selected media in one source. */
export const bulkEditMediaRequestSchema = z.object({
	mediaSourceId: z.uuid("Invalid source ID format"),
	mediaIds: z
		.array(z.uuid("Invalid media ID format"))
		.min(1, "At least one media ID is required"),
	updates: updateMediaRequestSchema,
});
export type BulkEditMediaRequest = z.infer<typeof bulkEditMediaRequestSchema>;

export const bulkDeleteMediaRequestSchema = z.object({
	mediaSourceId: z.uuid("Invalid source ID format"),
	mediaIds: z
		.array(z.uuid("Invalid media ID format"))
		.min(1, "At least one media ID is required"),
});
export type BulkDeleteMediaRequest = z.infer<
	typeof bulkDeleteMediaRequestSchema
>;

/** Moves selected media to a destination path within the source. */
export const bulkMoveMediaRequestSchema = z.object({
	mediaSourceId: z.uuid("Invalid source ID format"),
	mediaIds: z
		.array(z.uuid("Invalid media ID format"))
		.min(1, "At least one media ID is required"),
	destinationPath: z.string().min(1, "Destination path is required"),
});
export type BulkMoveMediaRequest = z.infer<typeof bulkMoveMediaRequestSchema>;

/** Adds and removes tag IDs on selected media. */
export const bulkTagMediaRequestSchema = z.object({
	mediaSourceId: z.uuid("Invalid source ID format"),
	mediaIds: z
		.array(z.uuid("Invalid media ID format"))
		.min(1, "At least one media ID is required"),
	tagsToAdd: z.array(z.uuid("Invalid tag ID format")),
	tagsToRemove: z.array(z.uuid("Invalid tag ID format")),
});
export type BulkTagMediaRequest = z.infer<typeof bulkTagMediaRequestSchema>;

/** Outcome of one item; messages are safe public text, never storage paths or exception details. */
export const bulkMediaItemResultSchema = z.discriminatedUnion("status", [
	z.object({ mediaId: z.uuid(), status: z.literal("succeeded") }),
	z.object({
		mediaId: z.uuid(),
		status: z.literal("failed"),
		error: z.string(),
		retryable: z.boolean().optional(),
	}),
	z.object({
		mediaId: z.uuid(),
		status: z.literal("not_processed"),
		error: z.string(),
	}),
]);
export type BulkMediaItemResult = z.infer<typeof bulkMediaItemResultSchema>;
export const bulkMediaOperationResultSchema = z.object({
	success: z.boolean(),
	items: z.array(bulkMediaItemResultSchema),
});
export type BulkMediaOperationResult = z.infer<
	typeof bulkMediaOperationResultSchema
>;

/** Copies selected media to another source. */
export const bulkCopyToSourceMediaRequestSchema = z.object({
	mediaSourceId: z.uuid("Invalid source ID format"),
	mediaIds: z
		.array(z.uuid("Invalid media ID format"))
		.min(1, "At least one media ID is required"),
	targetSourceId: z.uuid("Invalid target source ID format"),
});
export type BulkCopyToSourceMediaRequest = z.infer<
	typeof bulkCopyToSourceMediaRequestSchema
>;

/** Moves selected media to another source. */
export const bulkMoveToSourceMediaRequestSchema = z.object({
	mediaSourceId: z.uuid("Invalid source ID format"),
	mediaIds: z
		.array(z.uuid("Invalid media ID format"))
		.min(1, "At least one media ID is required"),
	targetSourceId: z.uuid("Invalid target source ID format"),
});
export type BulkMoveToSourceMediaRequest = z.infer<
	typeof bulkMoveToSourceMediaRequestSchema
>;
