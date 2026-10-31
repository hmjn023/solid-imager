import { z } from "zod";

export const EMBEDDING_GEMMA_DIMENSIONS = 768;
export const EMBEDDING_GEMMA_MODEL = "embeddinggemma-2-q8-768";
export const EMBEDDING_GEMMA_VERSION = 1;

export const similarityModelSchema = z.enum(["ccip", "embeddinggemma2"]);
export type SimilarityModel = z.infer<typeof similarityModelSchema>;

export const embeddingVectorSchema = z
	.array(z.number())
	.length(EMBEDDING_GEMMA_DIMENSIONS)
	.refine(
		(vector) => vector.some((value) => value !== 0),
		"Embedding must have nonzero norm",
	);
export const embeddingResponseSchema = z.object({
	feature: embeddingVectorSchema,
});
export const embeddingTextRequestSchema = z.object({
	text: z.string().trim().min(1).max(2000),
});
export const semanticSearchRequestSchema = embeddingTextRequestSchema.extend({
	mediaSourceId: z.uuid().optional(),
	topK: z.number().int().min(1).default(1000),
	limit: z.number().int().min(1).max(200).default(20),
	offset: z.number().int().nonnegative().default(0),
});
export type SemanticSearchRequest = z.infer<typeof semanticSearchRequestSchema>;

export const embeddingExtractionPayloadSchema = z.object({
	mediaId: z.uuid(),
	force: z.boolean().default(false),
});
