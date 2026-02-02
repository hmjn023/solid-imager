import { os } from "@orpc/server";
import {
  batchTaggingRequestSchema,
  ccipDifferenceRequestSchema,
  ccipFeatureRequestSchema,
  tagImageRequestSchema,
} from "@solid-imager/core/domain/tagging/schemas";
import { and, asc, eq, inArray, notExists } from "drizzle-orm";
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

  scanBatchTaggingTargets: os
    .input(batchTaggingRequestSchema)
    .handler(async ({ input }) => {
      const { mediaSourceId, force } = input;

      const whereClause = and(
        eq(medias.mediaType, "image"),
        mediaSourceId ? eq(medias.mediaSourceId, mediaSourceId) : undefined,
        force
          ? undefined
          : and(
              notExists(
                db
                  .select({ f: mediaTags.id })
                  .from(mediaTags)
                  .where(
                    and(
                      eq(mediaTags.mediaId, medias.id),
                      eq(mediaTags.source, "AI")
                    )
                  )
              ),
              notExists(
                db
                  .select({ f: mediaCharacters.id })
                  .from(mediaCharacters)
                  .where(
                    and(
                      eq(mediaCharacters.mediaId, medias.id),
                      eq(mediaCharacters.source, "AI")
                    )
                  )
              ),
              notExists(
                db
                  .select({ f: mediaIps.id })
                  .from(mediaIps)
                  .where(
                    and(
                      eq(mediaIps.mediaId, medias.id),
                      eq(mediaIps.source, "AI")
                    )
                  )
              )
            )
      );

      const results = await db.query.medias.findMany({
        where: whereClause,
        orderBy: asc(medias.id),
      });

      return results;
    }),

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

  startBatchTaggingWithIds: os
    .input(
      batchTaggingRequestSchema.extend({
        mediaIds: z.array(z.string()),
      })
    )
    .handler(async ({ input }) => {
      const { mediaIds, mediaSourceId, force } = input;
      const jobRepo = services.getJobRepository();

      const parentJob = await jobRepo.create({
        type: "bulk_tagging_parent",
        mediaSourceId,
        payload: {
          total: mediaIds.length,
          processed: 0,
        },
      });

      const mediaItems = await db.query.medias.findMany({
        where: inArray(medias.id, mediaIds),
        columns: { id: true, mediaSourceId: true },
      });

      const foundIds = new Set(mediaItems.map((m) => m.id));
      const notFoundIds = mediaIds.filter((id) => !foundIds.has(id));
      if (notFoundIds.length > 0) {
        logger.warn(
          { notFoundIds },
          "Some media IDs were not found for batch tagging"
        );
      }

      for (const media of mediaItems) {
        await jobRepo.create({
          type: "auto_tagging",
          mediaSourceId: media.mediaSourceId,
          parentId: parentJob.id,
          payload: {
            mediaId: media.id,
            force,
          },
        });
      }

      return {
        success: true,
        message: "Batch tagging started with selected media.",
        jobId: parentJob.id,
      };
    }),
};
