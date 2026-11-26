import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";
import {
	EMBEDDING_GEMMA_DIMENSIONS,
	EMBEDDING_GEMMA_MODEL,
	EMBEDDING_GEMMA_VERSION,
	embeddingResponseSchema,
	embeddingTextRequestSchema,
} from "../search/embedding";
import {
	CCIP_DIMENSIONS,
	CCIP_EMBEDDING_VERSION,
	CCIP_MODEL,
} from "../tagging/ccip";
import {
	ccipDifferenceResponseSchema,
	ccipDistancesRequestSchema,
	ccipDistancesResponseSchema,
	detectAndCropResponseSchema,
	oppaiOracleResponseSchema,
	taggingResponseSchema,
} from "../tagging/schemas";

const imageInput = z.object({ file: z.file().max(100 * 1024 * 1024) });
const ccipVector = z.array(z.number()).length(CCIP_DIMENSIONS);
const embeddingOutput = embeddingResponseSchema.extend({
	model: z.literal(EMBEDDING_GEMMA_MODEL),
	version: z.literal(EMBEDDING_GEMMA_VERSION),
	dimensions: z.literal(EMBEDDING_GEMMA_DIMENSIONS),
});

const procedure = (method: "GET" | "POST", path: string) =>
	oc.meta(openapi({ method, path: `/inference${path}` }));

/** Transport between the media application and the inference service. */
export const inferenceContract = {
	health: procedure("GET", "/health").output(
		z.object({ available: z.boolean() }),
	),
	offload: procedure("POST", "/offload")
		.input(z.object({}))
		.output(z.object({})),
	tag: procedure("POST", "/tag")
		.input(imageInput)
		.output(taggingResponseSchema),
	tagOppaiOracle: procedure("POST", "/tag/oppai-oracle")
		.input(imageInput)
		.output(oppaiOracleResponseSchema),
	ccipFeature: procedure("POST", "/ccip/features")
		.input(imageInput)
		.output(
			z.object({
				feature: ccipVector,
				model: z.literal(CCIP_MODEL),
				version: z.literal(CCIP_EMBEDDING_VERSION),
				dimensions: z.literal(CCIP_DIMENSIONS),
			}),
		),
	ccipDifference: procedure("POST", "/ccip/difference")
		.input(z.object({ feature1: ccipVector, feature2: ccipVector }))
		.output(ccipDifferenceResponseSchema),
	ccipDistances: procedure("POST", "/ccip/distances")
		.input(ccipDistancesRequestSchema)
		.output(ccipDistancesResponseSchema),
	embeddingImage: procedure("POST", "/embeddings/image")
		.input(imageInput)
		.output(embeddingOutput),
	embeddingText: procedure("POST", "/embeddings/text")
		.input(embeddingTextRequestSchema)
		.output(embeddingOutput),
	detectAndCropCharacters: procedure("POST", "/character-crops")
		.input(
			imageInput.extend({
				transparent: z
					.union([
						z.boolean(),
						z.stringbool({ truthy: ["true"], falsy: ["false"] }),
					])
					.default(false),
			}),
		)
		.output(detectAndCropResponseSchema),
};
