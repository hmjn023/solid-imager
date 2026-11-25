import { z } from "zod";
import {
	localConnectionSchema,
	mediaSourceIdSchema,
	mediaSourceInfoSchema,
} from "../sources/schemas";
import { semanticSearchRequestSchema } from "../search/embedding";
import {
	similarMediaRequestSchema,
	similarMediaScoreSchema,
} from "../tagging/schemas";
import {
	mediaGenerationInfoSchema,
	mediaLocationSchema,
	mediaSafeSchema,
	tagSchema,
} from "./schemas";
const pagination = {
	limit: z.int().min(1).max(100).default(20),
	offset: z.int().nonnegative().default(0),
};
const generationSummary = mediaGenerationInfoSchema
	.pick({
		aiGenerated: true,
		prompt: true,
		negativePrompt: true,
		modelName: true,
		seed: true,
		cfgScale: true,
		steps: true,
	})
	.nullable();

const namedItem = tagSchema.pick({ id: true, name: true });
const sourceSummarySchema = mediaSourceInfoSchema
	.pick({ name: true, type: true })
	.extend({ id: mediaSourceIdSchema });
const deliveryUrlSchema = z.url({ protocol: /^https?$/ });
const searchMediaItemSchema = mediaSafeSchema
	.pick({
		id: true,
		mediaSourceId: true,
		fileName: true,
		mediaType: true,
		width: true,
		height: true,
	})
	.extend({ thumbnailUrl: deliveryUrlSchema });
const rankedMediaSearchSchema = z.object({
	total: z.number(),
	media: z.array(
		searchMediaItemSchema.extend({
			cosineDistance: similarMediaScoreSchema.shape.cosineDistance,
		}),
	),
});

export const mediaToolInputs = {
	list_sources: z.strictObject({
		path: localConnectionSchema.shape.path.optional(),
		...pagination,
	}),
	create_local_source: z.strictObject({
		name: mediaSourceInfoSchema.shape.name.trim().min(1),
		path: localConnectionSchema.shape.path,
		description: mediaSourceInfoSchema.shape.description.default(null),
	}),
	search_media: z.strictObject({
		sourceId: z.uuid().optional(),
		query: z.string().trim().max(500).default(""),
		tags: z.array(z.string().trim().min(1)).max(20).default([]),
		...pagination,
	}),
	search_similar_media: similarMediaRequestSchema,
	search_semantic_media: semanticSearchRequestSchema,
	get_media_details: mediaLocationSchema.strict(),
	find_tags: z.strictObject({
		query: z.string().trim().max(500).default(""),
		...pagination,
	}),
	edit_media_tags: mediaLocationSchema.strict().extend({
		action: z.enum(["add", "remove"]),
		tagIds: z.array(z.uuid()).min(1).max(100),
	}),
};

export const mediaToolOutputs = {
	list_sources: z.object({
		sources: z.array(
			sourceSummarySchema.extend({
				directory: localConnectionSchema.shape.path.optional(),
			}),
		),
		total: z.int().nonnegative(),
		nextOffset: z.int().nonnegative().nullable(),
	}),
	create_local_source: z.object({
		source: sourceSummarySchema.extend({ type: z.literal("local") }),
		scan: z.literal("scheduled"),
	}),
	search_media: z.object({
		total: z.number(),
		media: z.array(searchMediaItemSchema),
	}),
	search_similar_media: rankedMediaSearchSchema,
	search_semantic_media: rankedMediaSearchSchema,
	get_media_details: mediaSafeSchema.extend({
		thumbnailUrl: deliveryUrlSchema,
		contentUrl: deliveryUrlSchema,
		generationInfo: generationSummary,
		tags: z.array(tagSchema.pick({ id: true, name: true, type: true })),
		authors: z.array(namedItem),
		characters: z.array(namedItem),
		ips: z.array(namedItem),
	}),
	find_tags: z.object({ total: z.number(), tags: z.array(namedItem) }),
	edit_media_tags: z.object({ success: z.boolean() }),
};
