import { oc } from "@orpc/contract";
import { z } from "zod";
import { mediaSafeSchema } from "../media/schemas";
import {
	batchCcipExtractionRequestSchema,
	batchTaggingRequestSchema,
	ccipDifferenceRequestSchema,
	ccipDistancesRequestSchema,
	ccipDistancesResponseSchema,
	ccipExtractionRequestSchema,
	ccipFeatureRequestSchema,
	ccipVectorStatusSchema,
	detectAndCropResponseSchema,
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
		.output(z.array(mediaSafeSchema)),

	startBatchCcipExtraction: oc
		.input(
			batchCcipExtractionRequestSchema.extend({
				mediaIds: z.array(z.string().uuid()).min(1),
			}),
		)
		.output(startCcipExtractionResponseSchema),

	scanBatchTaggingTargets: oc
		.input(batchTaggingRequestSchema)
		.output(z.array(mediaSafeSchema)),

	batchTagging: oc
		.input(batchTaggingRequestSchema)
		.output(z.object({ success: z.boolean(), message: z.string() })),

	startBatchTaggingWithIds: oc
		.input(
			batchTaggingRequestSchema.extend({
				mediaIds: z.array(z.string()),
			}),
		)
		.output(
			z.object({
				success: z.boolean(),
				message: z.string(),
				jobId: z.string(),
			}),
		),

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
