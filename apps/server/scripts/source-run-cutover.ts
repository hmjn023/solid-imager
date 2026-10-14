import { count, eq, inArray } from "drizzle-orm";
import { createSourceRunRepository } from "@solid-imager/db/repositories/source-run-repository";
import { retiredSourceJobTypes } from "@solid-imager/core/domain/source-runs/schemas";
import * as schema from "@solid-imager/db/schema";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { logger } from "../src/infrastructure/logger";
import { withMaintenanceDatabase } from "./maintenance-database";

const mode = process.argv[2] ?? "inspect";
if (!["inspect", "activate", "rollback"].includes(mode)) throw new Error("Use inspect, activate or rollback");
if (mode !== "inspect" && !process.argv.includes("--writers-stopped")) throw new Error("Stop/drain all source writers, then pass --writers-stopped");
await withMaintenanceDatabase(async database => {
 const repo = createSourceRunRepository(tx => (tx ?? database) as DrizzleExecutor);
 if (mode === "activate") logger.info(await repo.initialize(), "Source cutover complete");
 else if (mode === "rollback") logger.info(await repo.rollback(), "Source authority rolled back");
 else {
  const control = await database.select().from(schema.sourceRunCutovers);
  const sync = await database.select({ status: schema.sourceSyncRuns.status, count: count() }).from(schema.sourceSyncRuns).groupBy(schema.sourceSyncRuns.status);
  const transfer = await database.select({ kind: schema.sourceTransferRuns.kind, status: schema.sourceTransferRuns.status, count: count() }).from(schema.sourceTransferRuns).groupBy(schema.sourceTransferRuns.kind, schema.sourceTransferRuns.status);
  const blocked = await database.select({ reason: schema.sourceTransferRuns.failureCode, count: count() }).from(schema.sourceTransferRuns).where(eq(schema.sourceTransferRuns.status,"blocked")).groupBy(schema.sourceTransferRuns.failureCode);
  const [legacy] = await database.select({ count: count() }).from(schema.jobs).where(inArray(schema.jobs.type,[...retiredSourceJobTypes]));
  logger.info({ control, sync, transfer, blocked, legacyCount: legacy?.count ?? 0 }, "Source cutover inspection");
 }
});
