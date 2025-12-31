import { os } from "@orpc/server";
import { z } from "zod";
import { taggingService } from "~/application/services/tagging-service";
import {
  ccipDifferenceRequestSchema,
  ccipFeatureRequestSchema,
  tagImageRequestSchema,
} from "~/domain/tagging/schemas";

export const aiRouter = {
  tag: os
    .input(
      z.union([
        z.object({ file: z.instanceof(File) }),
        tagImageRequestSchema, // mediaSourceId + mediaId
      ])
    )
    .handler(async ({ input }) => {
      if ("file" in input) {
        const buffer = await input.file.arrayBuffer();
        return await taggingService.getTags(buffer);
      }

      const { mediaSourceId, mediaId } = input;
      if (!(mediaSourceId && mediaId)) {
        throw new Error("mediaSourceId and mediaId are required");
      }

      return await taggingService.getTagsForMedia(mediaSourceId, mediaId);
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
};
