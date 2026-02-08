import { and, eq, isNull, sql } from "drizzle-orm";
import { services } from "~/application/registry";
import { taggingService } from "~/application/services/tagging-service";
import { db } from "~/infrastructure/db";
import {
  type Job,
  mediaCharacters,
  medias,
  mediaTechnicalInfo,
  similarMedia,
} from "~/infrastructure/db/schema";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { logger } from "~/infrastructure/logger";

type CcipExtractionJobPayload = {
  mediaId: string;
  force?: boolean;
};

type BulkCcipExtractionJobPayload = {
  force?: boolean;
  batchSize?: number;
  mediaSourceId?: string;
};

type SimilarityCalculationJobPayload = {
  mediaSourceId?: string;
  threshold?: number; // Similarity threshold (distance)
};

const JOB_EVENTS_CHANNEL = "global-jobs";
const DEFAULT_BATCH_SIZE = 1000;
const SIMILARITY_BATCH_SIZE = 500;
const DEFAULT_THRESHOLD = 0.6;
const MAX_PROGRESS = 100;
const PERCENT_MULTIPLIER = 100;

export async function processCcipExtractionJob(job: Job): Promise<void> {
  const payload = job.payload as CcipExtractionJobPayload;
  const { mediaId, force } = payload;
  const { mediaSourceId, parentId } = job;

  if (!(mediaId && mediaSourceId)) {
    throw new Error("Missing mediaId or mediaSourceId");
  }

  try {
    await taggingService.getCcipFeatureForMedia(mediaSourceId, mediaId, {
      skipCache: force,
    });

    if (parentId) {
      const jobRepo = services.getJobRepository();
      await jobRepo.incrementProgress(parentId);
      // Note: Progress reporting logic similar to tagging-jobs can be added here
    }
  } catch (error) {
    logger.error({ err: error, mediaId }, "CCIP extraction failed");
    throw error;
  }
}

export async function processBulkCcipExtractionJob(job: Job): Promise<void> {
  const payload = job.payload as BulkCcipExtractionJobPayload;
  const force = payload?.force ?? false;
  const _batchSize = payload?.batchSize ?? DEFAULT_BATCH_SIZE;
  const mediaSourceId = payload?.mediaSourceId;

  const jobRepo = services.getJobRepository();

  const whereClause = and(
    eq(medias.mediaType, "image"),
    mediaSourceId ? eq(medias.mediaSourceId, mediaSourceId) : undefined,
    force ? undefined : isNull(mediaTechnicalInfo.hashCcip)
  );

  const query = db
    .select({
      id: medias.id,
      mediaSourceId: medias.mediaSourceId,
    })
    .from(medias)
    .leftJoin(mediaTechnicalInfo, eq(medias.id, mediaTechnicalInfo.mediaId))
    .where(whereClause);

  const results = await query;

  if (results.length === 0) {
    logger.info("No media found for CCIP extraction");
    return;
  }

  // Update parent job with total
  await jobRepo.update(job.id, {
    payload: { ...payload, total: results.length, processed: 0 },
  });

  for (const row of results) {
    await jobRepo.create({
      type: "ccip_extraction",
      mediaSourceId: row.mediaSourceId,
      parentId: job.id,
      payload: {
        mediaId: row.id,
        force,
      },
    });
  }

  logger.info({ total: results.length }, "Dispatched CCIP extraction jobs");
}

async function processBatchMatches(params: {
  queries: number[][];
  queryIds: string[];
  targets: number[][];
  targetIds: string[];
  threshold: number;
}): Promise<number> {
  const { queries, queryIds, targets, targetIds, threshold } = params;
  const diffsMatrix = await taggingService.getCcipBatchDifference(
    queries,
    targets
  );
  const newSimilarMedia: (typeof similarMedia.$inferInsert)[] = [];

  for (let qi = 0; qi < diffsMatrix.length; qi++) {
    for (let ti = 0; ti < diffsMatrix[qi].length; ti++) {
      const qId = queryIds[qi];
      const tId = targetIds[ti];
      const diff = diffsMatrix[qi][ti];

      // Avoid self-comparison and double-comparison
      if (qId >= tId) {
        continue;
      }

      if (diff <= threshold) {
        newSimilarMedia.push({
          media1Id: qId,
          media2Id: tId,
          similarityScore: 1 - diff, // Score is inverse of difference
          algorithm: "ccip",
        });
      }
    }
  }

  if (newSimilarMedia.length > 0) {
    // Upsert matches
    await db
      .insert(similarMedia)
      .values(newSimilarMedia)
      .onConflictDoUpdate({
        target: [
          similarMedia.media1Id,
          similarMedia.media2Id,
          similarMedia.algorithm,
        ],
        set: {
          similarityScore: sql`EXCLUDED.similarity_score`,
          createdAt: new Date(),
        },
      });
  }

  return newSimilarMedia.length;
}

export async function processSimilarityCalculationJob(job: Job): Promise<void> {
  const payload = job.payload as SimilarityCalculationJobPayload;
  const mediaSourceId = payload?.mediaSourceId;
  const threshold = payload?.threshold ?? DEFAULT_THRESHOLD;

  logger.info(
    { mediaSourceId, threshold },
    "Starting similarity calculation job"
  );

  // 1. Fetch all CCIP features
  const whereClause = and(
    eq(medias.mediaType, "image"),
    mediaSourceId ? eq(medias.mediaSourceId, mediaSourceId) : undefined,
    sql`${mediaTechnicalInfo.hashCcip} IS NOT NULL`
  );

  const allFeatures = await db
    .select({
      id: medias.id,
      feature: mediaTechnicalInfo.hashCcip,
    })
    .from(medias)
    .innerJoin(mediaTechnicalInfo, eq(medias.id, mediaTechnicalInfo.mediaId))
    .where(whereClause);

  if (allFeatures.length < 2) {
    logger.info("Not enough features for similarity calculation");
    return;
  }

  const ids = allFeatures.map((f) => f.id);
  const features = allFeatures.map((f) => f.feature as number[]);

  let matchesCount = 0;

  for (let i = 0; i < features.length; i += SIMILARITY_BATCH_SIZE) {
    const queries = features.slice(i, i + SIMILARITY_BATCH_SIZE);
    const queryIds = ids.slice(i, i + SIMILARITY_BATCH_SIZE);

    for (let j = 0; j < features.length; j += SIMILARITY_BATCH_SIZE) {
      const targets = features.slice(j, j + SIMILARITY_BATCH_SIZE);
      const targetIds = ids.slice(j, j + SIMILARITY_BATCH_SIZE);

      matchesCount += await processBatchMatches({
        queries,
        queryIds,
        targets,
        targetIds,
        threshold,
      });
    }

    // Update progress
    const progress = Math.min(
      MAX_PROGRESS,
      Math.round(
        ((i + SIMILARITY_BATCH_SIZE) / features.length) * PERCENT_MULTIPLIER
      )
    );
    SseManager.sendEvent(JOB_EVENTS_CHANNEL, "job-progress", {
      jobId: job.id,
      progress,
      message: `Comparing batch ${
        i / SIMILARITY_BATCH_SIZE + 1
      }... Found ${matchesCount} matches so far.`,
    });
  }

  logger.info({ matchesCount }, "Similarity calculation completed");

  // 4. Character Inference
  await inferCharactersFromSimilarity(threshold);
}

async function applyCharacterInference(
  sim: typeof similarMedia.$inferSelect,
  chars1: string[] | undefined,
  chars2: string[] | undefined
): Promise<number> {
  let count = 0;
  // If media1 has chars and media2 doesn't, suggest chars1 to media2
  if (chars1 && !chars2) {
    for (const charId of chars1) {
      await services.getCharacterRepository().addToMediaBulk(
        sim.media2Id,
        [
          {
            id: charId,
            confidence: sim.similarityScore,
          },
        ],
        "AI"
      );
      count++;
    }
  }
  // Vice versa
  if (chars2 && !chars1) {
    for (const charId of chars2) {
      await services.getCharacterRepository().addToMediaBulk(
        sim.media1Id,
        [
          {
            id: charId,
            confidence: sim.similarityScore,
          },
        ],
        "AI"
      );
      count++;
    }
  }
  return count;
}

async function inferCharactersFromSimilarity(threshold: number) {
  logger.info("Starting character inference from similarity");

  // Find all media with characters
  const mediaWithChars = await db
    .select({
      mediaId: mediaCharacters.mediaId,
      characterId: mediaCharacters.characterId,
      confidence: mediaCharacters.confidence,
    })
    .from(mediaCharacters)
    .where(eq(mediaCharacters.source, "manual")); // Trust manual assignments more

  if (mediaWithChars.length === 0) {
    return;
  }

  const charMap = new Map<string, string[]>(); // mediaId -> characterIds[]
  for (const row of mediaWithChars) {
    const chars = charMap.get(row.mediaId) || [];
    chars.push(row.characterId);
    charMap.set(row.mediaId, chars);
  }

  // Find similar pairs where one has characters and the other doesn't (or we want to suggest)
  const similarities = await db
    .select()
    .from(similarMedia)
    .where(
      and(
        eq(similarMedia.algorithm, "ccip"),
        sql`${similarMedia.similarityScore} >= ${1 - threshold}`
      )
    );

  let inferenceCount = 0;
  for (const sim of similarities) {
    inferenceCount += await applyCharacterInference(
      sim,
      charMap.get(sim.media1Id),
      charMap.get(sim.media2Id)
    );
  }

  logger.info({ inferenceCount }, "Character inference completed");
}
