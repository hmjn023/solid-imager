import { z } from "zod";
import {
	localConnectionSchema,
	mediaSourceInfoSchema,
	safeMediaSourceSchema,
} from "../sources/schemas";
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
export const mediaToolInputs = {
	list_sources: z.strictObject({}),
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
	list_sources: z.object({ sources: z.array(safeMediaSourceSchema) }),
	create_local_source: z.object({ source: safeMediaSourceSchema }),
	search_media: z.object({
		total: z.number(),
		media: z.array(mediaSafeSchema),
	}),
	get_media_details: mediaSafeSchema.extend({
		generationInfo: generationSummary,
		tags: z.array(tagSchema.pick({ id: true, name: true, type: true })),
		authors: z.array(namedItem),
		characters: z.array(namedItem),
		ips: z.array(namedItem),
	}),
	find_tags: z.object({ total: z.number(), tags: z.array(namedItem) }),
	edit_media_tags: z.object({ success: z.boolean() }),
};
