import { tmpdir } from "node:os";
import path from "node:path";
import { ORPCError, os } from "@orpc/server";
import {
  CCIP_EMBEDDING_VERSION,
  CCIP_MODEL,
} from "@solid-imager/application/services/ccip-vector-service";
import { createClient } from "@solid-imager/client";

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
  type NapiBBox,
  oppaiOracleResponseSchema,
  startBatchTaggingResponseSchema,
  startCcipExtractionResponseSchema,
  taggingResponseSchema,
  tagImageRequestSchema,
} from "@solid-imager/core/domain/tagging/schemas";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { services } from "~/application/registry";
import { ccipVectorService } from "~/application/services/ccip-vector-service";
import { taggingService } from "~/application/services/tagging-service";
import type { appRouter } from "~/domain/shared/api-contract";
import { db } from "~/infrastructure/db";
import {
  jobs,
  mediaCharacters,
  mediaIps,
  mediaSources,
  medias,
  mediaTags,
} from "~/infrastructure/db/schema";
import { logger } from "~/infrastructure/logger";

function isRemoteServerLocal(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0";
  } catch {
    return true;
  }
}

function getRemoteServerUrl(): string | undefined {
  const config = services.getConfigService().getConfig();
  const url = config.ai.baseUrl;
  if (!url || url.trim() === "") return undefined;
  return url;
}

async function readFileBuffer(filePath: string): Promise<Buffer> {
  const bytes = await Bun.file(filePath).bytes();
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function createRemoteOprcClient(remoteUrl: string, timeoutMs: number) {
  return createClient<typeof appRouter>({
    url: remoteUrl,
    fetch: async (request: Request, init?: RequestInit) => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(request, {
          ...init,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(t);
      }
    },
  });
}

async function callRemoteTagging(
  remoteUrl: string,
  fileBuffer: Buffer,
  fileName: string,
  timeoutMs: number,
): Promise<unknown> {
  const file = new File([new Uint8Array(fileBuffer)], fileName);
  const remoteOrpc = createRemoteOprcClient(remoteUrl, timeoutMs);
  return remoteOrpc.ai.tag({ file });
}

async function callRemoteCrop(
  remoteUrl: string,
  fileBuffer: Buffer,
  fileName: string,
  timeoutMs: number,
): Promise<unknown> {
  const file = new File([new Uint8Array(fileBuffer)], fileName);
  const remoteOrpc = createRemoteOprcClient(remoteUrl, timeoutMs);
  return remoteOrpc.ai.detectAndCropCharacters({ file });
}

async function cropDetection(
  imagePath: string,
  det: { bbox: NapiBBox; label: string; score: number },
  idx: number,
  transparent: boolean,
) {
  const { x1, y1, x2, y2 } = det.bbox;
  const w = Math.round(x2 - x1);
  const h = Math.round(y2 - y1);

  let cropBuffer: Buffer;
  let _format: string;

  if (transparent) {
    const cropPath = path.join(
      tmpdir(),
      `crop-seg-${Date.now()}-${idx}-${Math.random().toString(36).slice(2)}.png`,
    );
    await sharp(imagePath)
      .extract({
        left: Math.round(x1),
        top: Math.round(y1),
        width: w,
        height: h,
      })
      .png()
      .toFile(cropPath);
    try {
      const { segmentRgbaWithIsnetis } = await import("dghs-imgutils-rs");
      cropBuffer = Buffer.from(await segmentRgbaWithIsnetis(cropPath));
      _format = "png";
    } finally {
      await Bun.file(cropPath)
        .delete()
        .catch(() => {});
    }
  } else {
    cropBuffer = await sharp(imagePath)
      .extract({
        left: Math.round(x1),
        top: Math.round(y1),
        width: w,
        height: h,
      })
      .webp()
      .toBuffer();
    _format = "webp";
  }

  return {
    index: idx,
    bbox: { x1, y1, x2, y2 },
    label: det.label,
    score: det.score,
    imageBase64: cropBuffer.toString("base64"),
    width: w,
    height: h,
    format: transparent ? ("png" as const) : ("webp" as const),
  };
}

export const aiRouter = {
  tag: os
    .input(
      z.union([
        z.object({ file: z.instanceof(File) }),
        tagImageRequestSchema, // mediaSourceId + mediaId
      ]),
    )
    .handler(async ({ input }) => {
      const startedAt = Date.now();
      const logContext =
        "file" in input
          ? {
              inputType: "file",
              fileSize: input.file.size,
            }
          : {
              inputType: "media",
              mediaSourceId: input.mediaSourceId,
              mediaId: input.mediaId,
            };
      logger.info(logContext, "AI tagging started");
      try {
        if ("file" in input) {
          const buffer = await input.file.arrayBuffer();
          const result = await taggingService.getTags(buffer);
          logger.info(
            { ...logContext, durationMs: Date.now() - startedAt },
            "AI tagging completed",
          );
          return result;
        }

        const { mediaSourceId, mediaId } = input;
        if (!(mediaSourceId && mediaId)) {
          throw new Error("mediaSourceId and mediaId are required");
        }

        const remoteUrl = getRemoteServerUrl();
        const config = services.getConfigService().getConfig();
        if (remoteUrl && !isRemoteServerLocal(remoteUrl)) {
          const media = await services.getMediaRepository().findById(mediaId);
          if (!media) {
            throw new Error("Media not found");
          }
          const mediaSource = await services.getSourceRepository().findById(media.mediaSourceId);
          if (mediaSource?.type !== "local") {
            throw new Error("Only local media sources are supported for remote tagging");
          }
          const connectionInfo = mediaSource.connectionInfo as
            | Record<string, unknown>
            | null
            | undefined;
          if (!connectionInfo || typeof connectionInfo.path !== "string") {
            throw new Error("Media source connection path is missing or invalid");
          }
          const fullPath = path.join(connectionInfo.path, media.filePath);
          const fileBuffer = await readFileBuffer(fullPath);
          const result = taggingResponseSchema.parse(
            await callRemoteTagging(
              remoteUrl,
              fileBuffer,
              path.basename(fullPath),
              config.ai.timeoutMs,
            ),
          );
          logger.info(
            {
              ...logContext,
              execution: "remote",
              durationMs: Date.now() - startedAt,
            },
            "AI tagging completed",
          );
          return result;
        }

        const result = await taggingService.getTagsForMedia(mediaSourceId, mediaId);
        logger.info(
          {
            ...logContext,
            execution: "local",
            durationMs: Date.now() - startedAt,
          },
          "AI tagging completed",
        );
        return result;
      } catch (error) {
        logger.error(
          {
            err: error,
            ...logContext,
            durationMs: Date.now() - startedAt,
          },
          "AI tagging failed",
        );
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new ORPCError("UNPROCESSABLE_CONTENT", {
          message: `AI tagging failed: ${message}`,
        });
      }
    }),

  tagOppaiOracle: os
    .input(z.union([z.object({ file: z.instanceof(File) }), tagImageRequestSchema]))
    .handler(async ({ input }) => {
      const startedAt = Date.now();
      logger.info({ inputType: "file" in input ? "file" : "media" }, "OppaiOracle tagging started");
      try {
        if ("file" in input) {
          const buffer = await input.file.arrayBuffer();
          const ext = path.extname(input.file.name) || ".png";
          const tmpPath = path.join(
            tmpdir(),
            `oppai-oracle-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`,
          );
          await Bun.write(tmpPath, new Uint8Array(buffer));
          try {
            const result = await services.getAiClient().tagImageOppaiOracleByPath(tmpPath);
            logger.info({ durationMs: Date.now() - startedAt }, "OppaiOracle tagging completed");
            return result;
          } finally {
            await Bun.file(tmpPath)
              .delete()
              .catch(() => {});
          }
        }

        const { mediaSourceId, mediaId } = input;
        if (!(mediaSourceId && mediaId)) {
          throw new Error("mediaSourceId and mediaId are required");
        }

        const media = await services.getMediaRepository().findById(mediaId);
        if (!media) {
          throw new Error("Media not found");
        }
        const mediaSource = await services.getSourceRepository().findById(media.mediaSourceId);
        if (mediaSource?.type !== "local") {
          throw new Error("Only local media sources are supported for OppaiOracle tagging");
        }
        const connectionInfo = mediaSource.connectionInfo as
          | Record<string, unknown>
          | null
          | undefined;
        if (!connectionInfo || typeof connectionInfo.path !== "string") {
          throw new Error("Media source connection path is missing or invalid");
        }
        const fullPath = path.join(connectionInfo.path, media.filePath);

        const result = await services.getAiClient().tagImageOppaiOracleByPath(fullPath);
        logger.info({ durationMs: Date.now() - startedAt }, "OppaiOracle tagging completed");
        return result;
      } catch (error) {
        logger.error(
          { err: error, durationMs: Date.now() - startedAt },
          "OppaiOracle tagging failed",
        );
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new ORPCError("UNPROCESSABLE_CONTENT", {
          message: `OppaiOracle tagging failed: ${message}`,
        });
      }
    }),

  ccipFeature: os
    .input(z.union([z.object({ file: z.instanceof(File) }), ccipFeatureRequestSchema]))
    .handler(async ({ input }) => {
      if ("file" in input) {
        const buffer = await input.file.arrayBuffer();
        return await taggingService.getCcipFeature(buffer);
      }

      const { mediaSourceId, mediaId } = input;
      if (!(mediaSourceId && mediaId)) {
        throw new Error("mediaSourceId and mediaId are required");
      }

      return await taggingService.getCcipFeatureForMedia(mediaSourceId, mediaId);
    }),

  ccipDifference: os
    .input(ccipDifferenceRequestSchema)
    .handler(
      async ({ input }) => await taggingService.getCcipDifference(input.feature1, input.feature2),
    ),

  ccipDistances: os
    .input(ccipDistancesRequestSchema)
    .output(ccipDistancesResponseSchema)
    .handler(async ({ input }) => ({
      distances: await taggingService.getCcipDistances(input.feature, input.candidates),
    })),

  scanBatchTaggingTargets: os
    .input(batchTaggingRequestSchema)
    .output(batchTargetCountResponseSchema)
    .handler(async ({ input }) => {
      const { mediaSourceId, force } = input;

      const [{ count: rawCount }] = await db
        .select({
          count: sql<number>`count(distinct ${medias.id})`,
        })
        .from(medias)
        .leftJoin(mediaTags, and(eq(mediaTags.mediaId, medias.id), eq(mediaTags.source, "AI")))
        .leftJoin(
          mediaCharacters,
          and(eq(mediaCharacters.mediaId, medias.id), eq(mediaCharacters.source, "AI")),
        )
        .leftJoin(mediaIps, and(eq(mediaIps.mediaId, medias.id), eq(mediaIps.source, "AI")))
        .where(
          and(
            eq(medias.mediaType, "image"),
            mediaSourceId ? eq(medias.mediaSourceId, mediaSourceId) : undefined,
            force
              ? undefined
              : and(
                  isNull(mediaTags.mediaId),
                  isNull(mediaCharacters.mediaId),
                  isNull(mediaIps.mediaId),
                ),
          ),
        );

      return { count: Number(rawCount ?? 0) };
    }),

  startBatchTagging: os
    .input(batchTaggingRequestSchema)
    .output(startBatchTaggingResponseSchema)
    .handler(async ({ input }) => {
      const { mediaSourceId, force, batchSize } = input;
      const jobRepo = services.getJobRepository();

      const parentJob = await jobRepo.create({
        type: "bulk_tagging_parent",
        status: "in_progress",
        mediaSourceId,
        payload: {
          total: 0,
          processed: 0,
          failed: 0,
          mediaSourceId,
          force,
        },
      });

      await jobRepo.create({
        type: "bulk_tagging_dispatch",
        mediaSourceId,
        parentId: parentJob.id,
        payload: {
          mediaSourceId,
          force,
          ...(batchSize !== undefined ? { batchSize } : {}),
        },
      });

      logger.info(
        {
          jobId: parentJob.id,
          mediaSourceId,
          force: force ?? false,
        },
        "Batch tagging dispatch queued",
      );

      return {
        success: true,
        message: "Batch tagging dispatch queued",
        jobId: parentJob.id,
      };
    }),

  ccipVectorStatus: os
    .input(ccipExtractionRequestSchema.pick({ mediaSourceId: true, mediaId: true }))
    .output(ccipVectorStatusSchema)
    .handler(async ({ input }) => {
      try {
        const status = await ccipVectorService.getStatus(input.mediaSourceId, input.mediaId);
        const latestJob = await db.query.jobs.findFirst({
          where: and(
            eq(jobs.type, "extract_ccip_vector"),
            eq(jobs.mediaSourceId, input.mediaSourceId),
            sql`${jobs.payload}->>'mediaId' = ${input.mediaId}`,
          ),
          orderBy: desc(jobs.createdAt),
        });
        if (status.status === "ready" || status.status === "stale") {
          return status;
        }
        if (latestJob?.status === "pending" || latestJob?.status === "in_progress") {
          return { status: "processing" as const, jobId: latestJob.id };
        }
        if (latestJob?.status === "failed") {
          return {
            status: "failed" as const,
            jobId: latestJob.id,
            error: latestJob.error ?? "CCIP vector extraction failed",
          };
        }
        return status;
      } catch (error) {
        const isError = error instanceof Error;
        logger.error(
          {
            errorName: isError ? error.name : typeof error,
            errorMessage: isError ? error.message : String(error),
            errorStack: isError ? error.stack : undefined,
            mediaSourceId: input.mediaSourceId,
            mediaId: input.mediaId,
          },
          "CCIP vector status lookup failed",
        );
        throw error;
      }
    }),

  startCcipExtraction: os
    .input(ccipExtractionRequestSchema)
    .output(startCcipExtractionResponseSchema)
    .handler(async ({ input }) => {
      const job = await services.getJobRepository().create({
        type: "extract_ccip_vector",
        mediaSourceId: input.mediaSourceId,
        payload: { mediaId: input.mediaId, force: input.force },
      });
      logger.info(
        {
          jobId: job.id,
          mediaSourceId: input.mediaSourceId,
          mediaId: input.mediaId,
          force: input.force,
        },
        "CCIP vector extraction queued",
      );
      return {
        success: true,
        message: "CCIP vector extraction queued",
        jobId: job.id,
      };
    }),

  scanBatchCcipTargets: os
    .input(batchCcipExtractionRequestSchema)
    .output(batchTargetCountResponseSchema)
    .handler(async ({ input }) => {
      const rows = await db
        .select({
          id: medias.id,
          modifiedAt: medias.modifiedAt,
        })
        .from(medias)
        .innerJoin(mediaSources, eq(mediaSources.id, medias.mediaSourceId))
        .where(
          and(
            eq(medias.mediaType, "image"),
            eq(mediaSources.type, "local"),
            input.mediaSourceId ? eq(medias.mediaSourceId, input.mediaSourceId) : undefined,
          ),
        )
        .orderBy(asc(medias.id));
      if (input.force) return { count: rows.length };
      const records = new Map(
        (await ccipVectorService.listRecords(input.mediaSourceId)).map((record) => [
          record.mediaId,
          record,
        ]),
      );
      const count = rows.filter((row) => {
        const record = records.get(row.id);
        return (
          !record ||
          record.model !== CCIP_MODEL ||
          record.embeddingVersion !== CCIP_EMBEDDING_VERSION ||
          record.mediaModifiedAt.getTime() !== row.modifiedAt.getTime()
        );
      }).length;
      return { count };
    }),

  startBatchCcipExtraction: os
    .input(batchCcipExtractionRequestSchema)
    .output(startCcipExtractionResponseSchema)
    .handler(async ({ input }) => {
      const { mediaSourceId, force } = input;
      const jobRepo = services.getJobRepository();
      const parent = await jobRepo.create({
        type: "batch_ccip_parent",
        status: "in_progress",
        mediaSourceId,
        payload: {
          total: 0,
          processed: 0,
          failed: 0,
          mediaSourceId,
          force,
        },
      });
      await jobRepo.create({
        type: "batch_ccip_dispatch",
        mediaSourceId,
        parentId: parent.id,
        payload: {
          mediaSourceId,
          force,
        },
      });
      logger.info(
        {
          jobId: parent.id,
          mediaSourceId,
          force: force ?? false,
        },
        "Batch CCIP dispatch queued",
      );
      return {
        success: true,
        message: "Batch CCIP dispatch queued",
        jobId: parent.id,
      };
    }),

  detectAndCropCharacters: os
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
    .handler(async ({ input }) => {
      const startedAt = Date.now();
      const logContext =
        "file" in input
          ? {
              inputType: "file",
              fileName: input.file.name,
              fileSize: input.file.size,
              transparent: input.transparent,
            }
          : {
              inputType: "media",
              mediaId: input.mediaId,
              transparent: input.transparent,
            };
      logger.info(logContext, "Character detection and cropping started");
      try {
        const transparent = input.transparent ?? false;

        if ("file" in input) {
          const buffer = Buffer.from(await input.file.arrayBuffer());
          const tmpPath = path.join(
            tmpdir(),
            `crop-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          );
          await Bun.write(tmpPath, buffer);
          try {
            const { detectPerson } = await import("dghs-imgutils-rs");
            const detections = await detectPerson(tmpPath);

            const resultDetections = await Promise.all(
              detections.map(async (det, idx) => cropDetection(tmpPath, det, idx, transparent)),
            );

            logger.info(
              {
                ...logContext,
                detectionCount: resultDetections.length,
                durationMs: Date.now() - startedAt,
              },
              "Character detection and cropping completed",
            );
            return { detections: resultDetections };
          } finally {
            await Bun.file(tmpPath)
              .delete()
              .catch(() => {});
          }
        }

        const { mediaId } = input;
        const media = await services.getMediaRepository().findById(mediaId);
        if (!media) {
          throw new Error("Media not found");
        }
        const mediaSource = await services.getSourceRepository().findById(media.mediaSourceId);
        if (!mediaSource) {
          throw new Error("Media source not found");
        }
        if (mediaSource.type !== "local") {
          throw new Error("Only local media sources are supported for character detection");
        }

        const connectionInfo = mediaSource.connectionInfo as
          | Record<string, unknown>
          | null
          | undefined;
        if (!connectionInfo || typeof connectionInfo.path !== "string") {
          throw new Error("Media source connection path is missing or invalid");
        }
        const fullPath = path.join(connectionInfo.path, media.filePath);

        const remoteUrl = getRemoteServerUrl();
        const config = services.getConfigService().getConfig();
        if (remoteUrl && !isRemoteServerLocal(remoteUrl)) {
          const fileBuffer = await readFileBuffer(fullPath);
          const result = detectAndCropResponseSchema.parse(
            await callRemoteCrop(
              remoteUrl,
              fileBuffer,
              path.basename(fullPath),
              config.ai.timeoutMs,
            ),
          );
          logger.info(
            {
              ...logContext,
              execution: "remote",
              detectionCount: result.detections.length,
              durationMs: Date.now() - startedAt,
            },
            "Character detection and cropping completed",
          );
          return result;
        }

        const { detectPerson } = await import("dghs-imgutils-rs");
        const detections = await detectPerson(fullPath);

        const resultDetections = await Promise.all(
          detections.map(async (det, idx) => cropDetection(fullPath, det, idx, transparent)),
        );

        logger.info(
          {
            ...logContext,
            execution: "local",
            detectionCount: resultDetections.length,
            durationMs: Date.now() - startedAt,
          },
          "Character detection and cropping completed",
        );
        return { detections: resultDetections };
      } catch (error) {
        logger.error(
          {
            err: error,
            ...logContext,
            durationMs: Date.now() - startedAt,
          },
          "Character detection and cropping failed",
        );
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new ORPCError("UNPROCESSABLE_CONTENT", {
          message: `Character detection and cropping failed: ${message}`,
        });
      }
    }),
};
