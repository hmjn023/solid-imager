/// <reference types="bun-types" />

import { and, asc, count, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { services } from "../src/application/registry";
import { getCcipVectorService } from "../src/application/services/ccip-vector-service";
import { initServices } from "../src/infrastructure/bootstrap";
import { db } from "../src/infrastructure/db";
import { medias } from "../src/infrastructure/db/schema";
import { logger } from "../src/infrastructure/logger";

const usage =
  "Usage: bun scripts/extract-ccip-batch.ts <sourceId> <batchSize> <delayMs> [forceReextract]\n" +
  "  sourceId: UUID of the local media source\n" +
  "  batchSize: Number of extractions to run concurrently per batch (> 0)\n" +
  "  delayMs: Delay between batches in milliseconds (>= 0)\n" +
  "  forceReextract: true or false (default: false)";

const uuidSchema = z.string().uuid();

type ScriptOptions = {
  sourceId: string;
  batchSize: number;
  delayMs: number;
  forceReextract: boolean;
};

function parseInteger(value: string, name: string, minimum: number): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be an integer`);
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error(`${name} must be >= ${minimum}`);
  }
  return parsed;
}

function parseForceReextract(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error("forceReextract must be true or false");
}

function parseOptions(args: string[]): ScriptOptions {
  if (args.length < 3 || args.length > 4) {
    throw new Error(usage);
  }

  return {
    sourceId: uuidSchema.parse(args[0]),
    batchSize: parseInteger(args[1], "batchSize", 1),
    delayMs: parseInteger(args[2], "delayMs", 0),
    forceReextract: parseForceReextract(args[3]),
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(`${usage}\n`);
    return;
  }

  const options = parseOptions(args);
  initServices();

  const source = await services.getSourceRepository().findById(options.sourceId);
  if (!source) {
    throw new Error(`Media source not found: ${options.sourceId}`);
  }
  if (source.type !== "local") {
    throw new Error(`CCIP extraction requires a local source, got: ${source.type}`);
  }

  const config = services.getConfigService().getConfig();
  const executionMode = config.ai.baseUrl ? "remote" : "local";
  const [{ total }] = await db
    .select({ total: count() })
    .from(medias)
    .where(and(eq(medias.mediaSourceId, options.sourceId), eq(medias.mediaType, "image")));

  logger.info(
    {
      sourceId: options.sourceId,
      sourceName: source.name,
      total,
      batchSize: options.batchSize,
      delayMs: options.delayMs,
      forceReextract: options.forceReextract,
      executionMode,
    },
    "CCIP batch extraction started",
  );

  const ccipVectorService = getCcipVectorService();
  let lastId: string | undefined;
  let visited = 0;
  let extracted = 0;
  let skipped = 0;
  let failed = 0;
  let batchNumber = 0;

  while (true) {
    const batch = await db
      .select({ id: medias.id })
      .from(medias)
      .where(
        and(
          eq(medias.mediaSourceId, options.sourceId),
          eq(medias.mediaType, "image"),
          lastId ? gt(medias.id, lastId) : undefined,
        ),
      )
      .orderBy(asc(medias.id))
      .limit(options.batchSize);

    if (batch.length === 0) {
      break;
    }

    batchNumber += 1;
    const results = await Promise.allSettled(
      batch.map((media) =>
        ccipVectorService.extract(options.sourceId, media.id, options.forceReextract),
      ),
    );

    for (const [index, result] of results.entries()) {
      const mediaId = batch[index]?.id;
      if (result.status === "fulfilled") {
        if (result.value.skipped) {
          skipped += 1;
        } else {
          extracted += 1;
        }
        continue;
      }

      failed += 1;
      logger.error(
        { err: result.reason, mediaId, sourceId: options.sourceId },
        "CCIP extraction failed",
      );
    }

    visited += batch.length;
    lastId = batch.at(-1)?.id;
    logger.info(
      {
        sourceId: options.sourceId,
        batchNumber,
        batchCount: batch.length,
        visited,
        total,
        extracted,
        skipped,
        failed,
      },
      "CCIP extraction batch completed",
    );

    if (batch.length === options.batchSize && options.delayMs > 0) {
      await Bun.sleep(options.delayMs);
    }
  }

  logger.info(
    {
      sourceId: options.sourceId,
      visited,
      total,
      extracted,
      skipped,
      failed,
    },
    "CCIP batch extraction finished",
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error({ err: error }, "CCIP batch extraction script failed");
  process.exitCode = 1;
});
