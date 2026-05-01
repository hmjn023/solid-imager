import { os } from "@orpc/server";
import {
	createBatchTaggingDispatchJob,
	createBatchTaggingParentJob,
	scanBatchTaggingTargets,
} from "@solid-imager/application/services/batch-tagging";
import {
	batchTaggingRequestSchema,
	ccipDifferenceRequestSchema,
	ccipFeatureRequestSchema,
	tagImageRequestSchema,
} from "@solid-imager/core/domain/tagging/schemas";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { services } from "~/application/registry";
import { taggingService } from "~/application/services/tagging-service";
import { db } from "~/infrastructure/db";
import {
	mediaCharacters,
	mediaIps,
	medias,
	mediaTags,
} from "~/infrastructure/db/schema";
import { logger } from "~/infrastructure/logger";

export const aiRouter = {
	tag: os
		.input(
			z.union([
				z.object({ file: z.instanceof(File) }),
				tagImageRequestSchema, // mediaSourceId + mediaId
			]),
		)
		.handler(async ({ input }) => {
			try {
				if ("file" in input) {
					const buffer = await input.file.arrayBuffer();
					return await taggingService.getTags(buffer);
				}

				const { mediaSourceId, mediaId } = input;
				if (!(mediaSourceId && mediaId)) {
					throw new Error("mediaSourceId and mediaId are required");
				}

				return await taggingService.getTagsForMedia(mediaSourceId, mediaId);
			} catch (error) {
				logger.error({ err: error, input }, "AI tagging failed");
				throw error;
			}
		}),

	ccipFeature: os
		.input(
			z.union([
				z.object({ file: z.instanceof(File) }),
				ccipFeatureRequestSchema,
			]),
		)
		.handler(async ({ input }) => {
			if ("file" in input) {
				const buffer = await input.file.arrayBuffer();
				return await taggingService.getCcipFeature(buffer);
			}

			const { mediaSourceId, mediaId } = input;
			if (!(mediaSourceId && mediaId)) {
				throw new Error("mediaSourceId and mediaId are required");
			}

			return await taggingService.getCcipFeatureForMedia(
				mediaSourceId,
				mediaId,
			);
		}),

	ccipDifference: os
		.input(ccipDifferenceRequestSchema)
		.handler(
			async ({ input }) =>
				await taggingService.getCcipDifference(input.feature1, input.feature2),
		),

	scanBatchTaggingTargets: os
		.input(batchTaggingRequestSchema)
		.handler(async ({ input }) => {
			const results = await scanBatchTaggingTargets(db, input, {
				medias,
				mediaTags,
				mediaCharacters,
				mediaIps,
			});
			return results as any[];
		}),

	batchTagging: os
		.input(batchTaggingRequestSchema)
		.handler(async ({ input }) => {
			const jobRepo = services.getJobRepository();
			await createBatchTaggingDispatchJob(jobRepo, input, input);
			return { success: true, message: "Batch tagging started" };
		}),

	startBatchTaggingWithIds: os
		.input(
			batchTaggingRequestSchema.extend({
				mediaIds: z.array(z.string()),
			}),
		)
		.handler(async ({ input }) => {
			const { mediaIds, mediaSourceId, force } = input;
			const jobRepo = services.getJobRepository();

			return await createBatchTaggingParentJob(
				jobRepo,
				async (ids) => {
					const mediaItems = await db.query.medias.findMany({
						where: inArray(medias.id, ids),
						columns: { id: true, mediaSourceId: true },
					});

					const foundIds = new Set(mediaItems.map((m) => m.id));
					const notFoundIds = ids.filter((id) => !foundIds.has(id));
					if (notFoundIds.length > 0) {
						logger.warn(
							{ notFoundIds },
							"Some media IDs were not found for batch tagging",
						);
					}

					return mediaItems;
				},
				{ mediaIds, mediaSourceId, force },
			);
		}),
};
