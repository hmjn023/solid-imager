import type { CcipVectorRecord } from "@solid-imager/application/ports/ccip-vector-store";
import { medias } from "@solid-imager/db/schema";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { services } from "../src/application/registry";
import { PostgresCcipVectorStore } from "../src/infrastructure/ai/postgres-ccip-vector-store";
import { LanceDbCcipVectorStore } from "../src/infrastructure/ai/lancedb-ccip-vector-store";
import { initServices } from "../src/infrastructure/bootstrap";
import { db } from "../src/infrastructure/db";
import { logger } from "../src/infrastructure/logger";

const usage =
  "Usage: bun scripts/migrate-ccip-lancedb.ts [--dry-run] [--source-id <uuid>] [--batch-size <positive integer>]";
const uuidSchema = z.string().uuid();

type MigrationOptions = {
  dryRun: boolean;
  mediaSourceId?: string;
  batchSize: number;
};

function parsePositiveInteger(value: string, name: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a positive integer`);
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseOptions(args: string[]): MigrationOptions {
  const options: MigrationOptions = { dryRun: false, batchSize: 100 };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (argument === "--source-id") {
      const value = args[index + 1];
      if (!value) throw new Error("--source-id requires a UUID");
      options.mediaSourceId = uuidSchema.parse(value);
      index += 1;
      continue;
    }
    if (argument === "--batch-size") {
      const value = args[index + 1];
      if (!value) throw new Error("--batch-size requires a value");
      options.batchSize = parsePositiveInteger(value, "--batch-size");
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

function migrationKey(record: CcipVectorRecord): string {
  return `${record.mediaId}:${record.model}:${record.embeddingVersion}`;
}

function recordsMatch(left: CcipVectorRecord, right: CcipVectorRecord): boolean {
  return (
    left.mediaSourceId === right.mediaSourceId &&
    left.mediaModifiedAt.getTime() === right.mediaModifiedAt.getTime() &&
    left.vector.length === right.vector.length &&
    left.vector.every((value, index) => value === right.vector[index])
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(`${usage}\n`);
    return;
  }
  const options = parseOptions(args);
  initServices();
  const config = services.getConfigService().getConfig();
  const legacyStore = new LanceDbCcipVectorStore(config.lancedb.ccipVectorDir, {
    readOnly: true,
  });
  const targetStore = options.dryRun ? null : new PostgresCcipVectorStore(db);
  let rawRows = 0;
  let uniqueLogicalRows = 0;
  let collapsedDuplicates = 0;
  let migrated = 0;
  let skippedMissingMediaRecords = 0;
  let current: CcipVectorRecord | null = null;
  let pending: CcipVectorRecord[] = [];

  const flush = async (): Promise<void> => {
    if (pending.length === 0) return;
    const batch = pending;
    pending = [];
    const mediaIds = [...new Set(batch.map((record) => record.mediaId))];
    const existingMedia = await db
      .select({ id: medias.id })
      .from(medias)
      .where(inArray(medias.id, mediaIds));
    const existingMediaIds = new Set(existingMedia.map((media) => media.id));
    const importable = batch.filter((record) => existingMediaIds.has(record.mediaId));
    skippedMissingMediaRecords += batch.length - importable.length;

    if (targetStore && importable.length > 0) {
      await targetStore.upsertMany(importable);
      migrated += importable.length;
      logger.info(
        {
          migrated,
          batchSize: importable.length,
          skippedMissingMediaRecords,
        },
        "CCIP LanceDB migration batch completed",
      );
    }
  };

  for await (const records of legacyStore.listBatches(options.batchSize, {
    mediaSourceId: options.mediaSourceId,
  })) {
    rawRows += records.length;
    for (const record of records) {
      if (!current) {
        current = record;
        continue;
      }
      if (migrationKey(current) === migrationKey(record)) {
        if (!recordsMatch(current, record)) {
          throw new Error(`Conflicting LanceDB CCIP records for ${migrationKey(record)}`);
        }
        collapsedDuplicates += 1;
        if (record.extractedAt.getTime() > current.extractedAt.getTime()) {
          current = record;
        }
        continue;
      }
      pending.push(current);
      uniqueLogicalRows += 1;
      current = record;
      if (pending.length >= options.batchSize) {
        await flush();
      }
    }
  }
  if (current) {
    pending.push(current);
    uniqueLogicalRows += 1;
  }
  await flush();

  logger.info(
    {
      dryRun: options.dryRun,
      mediaSourceId: options.mediaSourceId,
      rawRows,
      uniqueLogicalRows,
      collapsedDuplicates,
      migrated,
      skippedMissingMediaRecords,
      batchSize: options.batchSize,
    },
    "CCIP LanceDB migration completed",
  );
}

main().catch((error: unknown) => {
  logger.error({ err: error }, "CCIP LanceDB migration failed");
  process.exitCode = 1;
});
