import { and, asc, eq, inArray, notExists } from "drizzle-orm";
import { services } from "~/application/registry";
import { eventService } from "~/application/services/event-service";
import { taggingService } from "~/application/services/tagging-service";
import { db } from "~/infrastructure/db";
import {
  type Job,
  mediaCharacters,
  mediaIps,
  medias,
  mediaTags,
} from "~/infrastructure/db/schema";
import { logger } from "~/infrastructure/logger";

type AutoTaggingJobPayload = {
  mediaId: string;
  force?: boolean;
};

type BulkTaggingDispatchJobPayload = {
  force?: boolean;
  batchSize?: number;
  mediaSourceId?: string;
  mediaIds?: string[];
};

export async function processAutoTaggingJob(job: Job): Promise<void> {
  const payload = job.payload as AutoTaggingJobPayload;
  const { mediaId, force } = payload;
  const { mediaSourceId } = job;

  if (!(mediaId && mediaSourceId)) {
    throw new Error("Missing mediaId or mediaSourceId");
  }

  try {
    await taggingService.getTagsForMedia(mediaSourceId, mediaId, {
      skipCache: force,
    });
    eventService.sendSseEvent("tagging:job-completed", {
      mediaId,
      jobId: job.id,
    });
  } catch (error) {
    logger.error({ err: error, mediaId }, "Auto tagging failed");
    throw error;
  }
}

export async function processBulkTaggingDispatchJob(job: Job): Promise<void> {
  const payload = job.payload as BulkTaggingDispatchJobPayload;
  const force = payload?.force ?? false;
  // biome-ignore lint/style/noMagicNumbers: Default batch size
  const batchSize = payload?.batchSize ?? 1000;
  const mediaSourceId = payload?.mediaSourceId;
  const { mediaIds } = payload;

  logger.info(
    {
      jobId: job.id,
      mediaSourceId,
      force,
      batchSize,
      numMediaIds: mediaIds?.length,
    },
    "Starting bulk tagging dispatch job"
  );

  const jobRepo = services.getJobRepository();
  const mediaRepo = services.getMediaRepository();
  let processedCount = 0;

  if (mediaIds && mediaIds.length > 0) {
    // Case 1: Specific media IDs are provided
    const validMedia = await db
      .select({ id: medias.id, mediaSourceId: medias.mediaSourceId })
      .from(medias)
      .where(inArray(medias.id, mediaIds));

    eventService.sendSseEvent("tagging:batch-started", {
      total: validMedia.length,
      jobId: job.id,
    });

    for (const media of validMedia) {
      await jobRepo.create({
        type: "auto_tagging",
        mediaSourceId: media.mediaSourceId,
        payload: {
          mediaId: media.id,
          force,
        },
      });
      processedCount++;
    }
  } else {
    // Case 2: No specific media IDs, find candidates
    let offset = 0;
    while (true) {
      const candidates = await mediaRepo.findTaggingCandidates({
        mediaSourceId,
        force,
        limit: batchSize,
        offset,
      });

      if (candidates.length === 0) {
        if (processedCount === 0) {
          logger.info(
            { jobId: job.id, mediaSourceId, force },
            "No matching images found for bulk tagging"
          );
        }
        break;
      }

      for (const candidate of candidates) {
        await jobRepo.create({
          type: "auto_tagging",
          mediaSourceId: candidate.mediaSourceId,
          payload: {
            mediaId: candidate.id,
            force,
          },
        });
      }

      processedCount += candidates.length;
      offset += batchSize;

      logger.info(
        { jobId: job.id, processedCount },
        "Bulk tagging dispatch progress"
      );
    }
  }

  logger.info(
    { jobId: job.id, processedCount },
    "Bulk tagging dispatch completed"
  );
}
