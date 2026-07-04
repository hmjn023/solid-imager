import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	batchCcipExtractionRequestSchema,
	batchTaggingRequestSchema,
	batchTargetCountResponseSchema,
	ccipDifferenceRequestSchema,
	ccipDistancesRequestSchema,
	ccipDistancesResponseSchema,
	ccipExtractionRequestSchema,
	ccipFeatureRequestSchema,
	ccipVectorStatusSchema,
	detectAndCropResponseSchema,
	startBatchTaggingResponseSchema,
	startCcipExtractionResponseSchema,
	taggingResponseSchema,
	tagImageRequestSchema,
} from "../tagging/schemas";

export const aiContract = {
	tag: oc
		.input(
			z.union([z.object({ file: z.instanceof(File) }), tagImageRequestSchema]),
		)
		.output(taggingResponseSchema),

	tagRustExperimental: oc.input(
		z.union([
			z.object({ mediaId: z.string().uuid() }),
			z.object({ file: z.instanceof(File) }),
		]),
	),

	ccipFeature: oc.input(
		z.union([z.object({ file: z.instanceof(File) }), ccipFeatureRequestSchema]),
	),

	ccipDifference: oc.input(ccipDifferenceRequestSchema),

	ccipDistances: oc
		.input(ccipDistancesRequestSchema)
		.output(ccipDistancesResponseSchema),

	ccipVectorStatus: oc
		.input(
			ccipExtractionRequestSchema.pick({ mediaSourceId: true, mediaId: true }),
		)
		.output(ccipVectorStatusSchema),

	startCcipExtraction: oc
		.input(ccipExtractionRequestSchema)
		.output(startCcipExtractionResponseSchema),

	scanBatchCcipTargets: oc
		.input(batchCcipExtractionRequestSchema)
		.output(batchTargetCountResponseSchema),

	startBatchCcipExtraction: oc
		.input(batchCcipExtractionRequestSchema)
		.output(startCcipExtractionResponseSchema),

	scanBatchTaggingTargets: oc
		.input(batchTaggingRequestSchema)
		.output(batchTargetCountResponseSchema),

	startBatchTagging: oc
		.input(batchTaggingRequestSchema)
		.output(startBatchTaggingResponseSchema),

	detectAndCropCharacters: oc
		.input(
			z.union([
				z.object({
					mediaId: z.string().uuid(),
					transparent: z.boolean().optional().default(false),
				}),
				z.object({
					file: z.instanceof(File),
					transparent: z.boolean().optional().default(false),
				}),
			]),
		)
		.output(detectAndCropResponseSchema),
};
