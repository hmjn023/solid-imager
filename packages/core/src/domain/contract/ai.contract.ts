import { oc } from "@orpc/contract";
import { z } from "zod";
import { mediaSchema } from "../media/schemas";
import {
	batchTaggingRequestSchema,
	ccipDifferenceRequestSchema,
	ccipFeatureRequestSchema,
	detectAndCropResponseSchema,
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

	scanBatchTaggingTargets: oc
		.input(batchTaggingRequestSchema)
		.output(z.array(mediaSchema)),

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
