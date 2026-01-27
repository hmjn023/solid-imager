import { and, asc, eq, notExists } from "drizzle-orm";
import { services } from "~/application/registry";
import { taggingService } from "~/application/services/tagging-service";
import { db } from "~/infrastructure/db";
import { type Job, medias, mediaTags } from "~/infrastructure/db/schema";
import { logger } from "~/infrastructure/logger";

type AutoTaggingJobPayload = {
  mediaId: string;
  mediaSourceId: string;
  force?: boolean;
};

type BulkTaggingDispatchJobPayload = {
  force?: boolean;
  batchSize?: number;
  mediaSourceId?: string;
};

export async function processAutoTaggingJob(job: Job): Promise<void> {
  const payload = job.payload as AutoTaggingJobPayload;
  const { mediaId, mediaSourceId, force } = payload;

  if (!(mediaId && mediaSourceId)) {
    throw new Error("Missing mediaId or mediaSourceId");
  }

  try {
    await taggingService.getTagsForMedia(mediaSourceId, mediaId, {
      skipCache: force,
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

  const jobRepo = services.getJobRepository();

  // Find images
  // Logic: media_type = 'image' AND (source_id = ? IF set) AND (force OR NOT EXISTS(AI tags))
  const whereClause = and(
    eq(medias.mediaType, "image"),
    mediaSourceId ? eq(medias.mediaSourceId, mediaSourceId) : undefined,
    force
      ? undefined
      : notExists(
          db
            .select()
            .from(mediaTags)
            .where(
              and(eq(mediaTags.mediaId, medias.id), eq(mediaTags.source, "AI"))
            )
        )
  );

  let offset = 0;
  let processedCount = 0;

  while (true) {
    const results = await db
      .select({
        id: medias.id,
        mediaSourceId: medias.mediaSourceId,
      })
      .from(medias)
      .where(whereClause)
      .orderBy(asc(medias.id))
      .limit(batchSize)
      .offset(offset);

    if (results.length === 0) {
      break;
    }

    // Create jobs
    for (const row of results) {
      await jobRepo.create({
        type: "auto_tagging",
        mediaSourceId: row.mediaSourceId,
        payload: {
          mediaId: row.id,
          mediaSourceId: row.mediaSourceId,
          force,
        },
      });
    }

    processedCount += results.length;
    offset += batchSize;

    // Log progress
    logger.info(
      { jobId: job.id, processedCount },
      "Bulk tagging dispatch progress"
    );
  }

  logger.info(
    { jobId: job.id, processedCount },
    "Bulk tagging dispatch completed"
  );
}
