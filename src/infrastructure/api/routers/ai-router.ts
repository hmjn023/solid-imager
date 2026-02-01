import { os } from "@orpc/server";
import {
  batchTaggingRequestSchema,
  ccipDifferenceRequestSchema,
  ccipFeatureRequestSchema,
  tagImageRequestSchema,
} from "@solid-imager/core/domain/tagging/schemas";
import { z } from "zod";
import { services } from "~/application/registry";
import { taggingService } from "~/application/services/tagging-service";
import { logger } from "~/infrastructure/logger";

export const aiRouter = {
  tag: os
    .input(
      z.union([
        z.object({ file: z.instanceof(File) }),
        tagImageRequestSchema, // mediaSourceId + mediaId
      ])
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
      ])
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
        mediaId
      );
    }),

  ccipDifference: os
    .input(ccipDifferenceRequestSchema)
    .handler(
      async ({ input }) =>
        await taggingService.getCcipDifference(input.feature1, input.feature2)
    ),

  batchTagging: os
    .input(batchTaggingRequestSchema)
    .handler(async ({ input }) => {
      const jobRepo = services.getJobRepository();
      await jobRepo.create({
        type: "bulk_tagging_dispatch",
        mediaSourceId: input.mediaSourceId, // Optional but good for tracking if provided
        payload: input,
      });
      return { success: true, message: "Batch tagging started" };
    }),
};
