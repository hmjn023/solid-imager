import { z } from "zod";

/** Dimensions, model identifier and format version used for stored embeddings. */
export const EMBEDDING_GEMMA_DIMENSIONS = 768;
export const EMBEDDING_GEMMA_MODEL = "embeddinggemma-2-q8-768";
export const EMBEDDING_GEMMA_VERSION = 1;

export const similarityModelSchema = z.enum(["ccip", "embeddinggemma2"]);
export type SimilarityModel = z.infer<typeof similarityModelSchema>;

/** A 768-component embedding with at least one nonzero component. */
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
/** Text to embed, trimmed before validation; must contain 1–2000 characters. */
export const embeddingTextRequestSchema = z.object({
	text: z.string().trim().min(1).max(2000),
});
/**
 * Semantic search input. `topK` selects candidates (default 1000); `limit`
 * (1–200, default 20) and nonnegative `offset` (default 0) page the results.
 */
export const semanticSearchRequestSchema = embeddingTextRequestSchema.extend({
	mediaSourceId: z.uuid().optional(),
	topK: z.number().int().min(1).default(1000),
	limit: z.number().int().min(1).max(200).default(20),
	offset: z.number().int().nonnegative().default(0),
});
export type SemanticSearchRequest = z.infer<typeof semanticSearchRequestSchema>;

/** Background extraction input; force requests regeneration of an existing embedding. */
export const embeddingExtractionPayloadSchema = z.object({
	mediaId: z.uuid(),
	force: z.boolean().default(false),
});
