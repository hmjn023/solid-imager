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
	fileSize: z.number().int().positive("File size must be a positive integer"),
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
	sourceUrls: z.array(z.string().url("Invalid URL format")).optional(),
	authors: z
		.array(
			z.object({
				name: z.string(),
				accountId: z.string().optional().nullable(),
			}),
		)
		.optional(),
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
		}),
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
	confidence: z.number().nullable().optional(), // from mediaTags
});
// ...existing code...
export type MediaTag = z.infer<typeof tagSchema>;

export const characterSchema = z.object({
	id: z.string().uuid(),
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
	id: z.string().uuid(),
	name: z.string(),
	description: z.string().nullable(),
	source: z.string(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	confidence: z.number().nullable().optional(), // from mediaIps
	linkSource: z.string().optional(), // from mediaIps source
});
export type MediaIp = z.infer<typeof ipSchema>;

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
export type MediaGenerationInfo = z.infer<typeof mediaGenerationInfoSchema>;

// Search schemas
export const filterOperatorSchema = z.enum([
	"equals", // 完全一致
	"contains", // 部分一致 (LIKE %val%)
	"startsWith", // 前方一致 (LIKE val%)
	"endsWith", // 後方一致 (LIKE %val)
	"gt", // Greater than (>)
	"gte", // Greater than or equal (>=)
	"lt", // Less than (<)
	"lte", // Less than or equal (<=)
	"in", // 配列に含まれる (IN)
	"notIn", // 配列に含まれない (NOT IN)
	"isEmpty", // 空またはNULL
	"isNotEmpty", // 空でない
]);

export const filterTargetSchema = z.enum([
	"keyword", // 全文検索 (ファイル名, パス, 説明, プロンプト等)
	"fileName",
	"filePath",
	"description",
	"mediaType",
	"width",
	"height",
	"fileSize",
	"createdAt",
	"rating",
	"favorite",
	"viewCount",
	"aiGenerated",
	// 関連テーブル
	"tag", // タグ名またはID
	"author", // 作者名またはID
	"project", // プロジェクト名またはID
	"ip", // IP名またはID
	"character", // キャラクター名またはID
	"folder", // ディレクトリパス (前方一致など)
]);

// 単一の検索条件ノード
// 注意: operator と value の整合性はアプリケーション層で検証する
// 例: isEmpty/isNotEmpty の場合は value を無視、in/notIn の場合は配列を期待
export const searchCriterionSchema = z.object({
	type: z.literal("criterion"),
	target: filterTargetSchema,
	operator: filterOperatorSchema.default("equals"),
	value: z
		.union([
			z.string(),
			z.number(),
			z.boolean(),
			z.array(z.string()),
			z.array(z.number()),
		])
		.nullable(),
	negate: z.boolean().default(false).optional(), // NOT条件
});

export type SearchCriterion = z.infer<typeof searchCriterionSchema>;

// 条件グループノード (AND/OR)
export type SearchGroup = {
	type: "group";
	operator: "and" | "or";
	children: (SearchGroup | z.infer<typeof searchCriterionSchema>)[];
	negate?: boolean;
};

export const searchGroupSchema: z.ZodType<SearchGroup> = z.lazy(() =>
	z.object({
		type: z.literal("group"),
		operator: z.enum(["and", "or"]),
		// children が空の場合、このグループは条件なしとして扱われる（無視される）
		children: z.array(z.union([searchGroupSchema, searchCriterionSchema])),
		negate: z.boolean().default(false).optional(),
	}),
);

export const mediaSearchRequestSchema = z.object({
	condition: searchGroupSchema.optional(),
	sort: z.enum(["date", "name", "size", "rating", "viewCount"]).optional(),
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
					? val.filter((v) => {
							try {
								new URL(v);
								return true;
							} catch {
								return false;
							}
						})
					: val,
			z.array(z.string().url()),
		)
		.optional(),
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
	targetUrl: z.string().url("Invalid target URL").optional(),

	// Restore fields
	filePath: z.string().optional(),
	fileName: z.string().optional(),

	// Technical options
	cookies: z.array(z.any()).optional(),
	userAgent: z.string().optional(),
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

// Preset schemas
export const presetSchema = z.object({
	id: z.number().int(),
	name: z.string().min(1, "Name is required"),
	// Note: searchGroupSchema is lazy, so we use it directly.
	// The database stores JSONB, so we validate it against the structure.
	value: searchGroupSchema,
	sort: z.enum(["date", "name", "size", "rating", "viewCount"]).optional(),
	order: z.enum(["asc", "desc"]).optional(),
	mode: z.enum(["simple", "pro"]).optional(),
	createdAt: z.coerce.date(),
});

export type Preset = z.infer<typeof presetSchema>;

export const createPresetRequestSchema = z.object({
	name: z.string().min(1, "Name is required"),
	value: searchGroupSchema,
	sort: z.enum(["date", "name", "size", "rating", "viewCount"]).optional(),
	order: z.enum(["asc", "desc"]).optional(),
	mode: z.enum(["simple", "pro"]).optional(),
});

export type CreatePresetRequest = z.infer<typeof createPresetRequestSchema>;

export const updatePresetRequestSchema = z.object({
	name: z.string().min(1, "Name is required").optional(),
	value: searchGroupSchema.optional(),
	sort: z.enum(["date", "name", "size", "rating", "viewCount"]).optional(),
	order: z.enum(["asc", "desc"]).optional(),
	mode: z.enum(["simple", "pro"]).optional(),
});

export type UpdatePresetRequest = z.infer<typeof updatePresetRequestSchema>;
