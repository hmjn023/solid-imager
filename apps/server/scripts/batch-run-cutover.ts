import { count, eq, inArray } from "drizzle-orm";
import { createBatchRunRepository } from "@solid-imager/db/repositories/batch-run-repository";
import { retiredBatchJobTypes } from "@solid-imager/core/domain/batches/schemas";
import * as schema from "@solid-imager/db/schema";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { logger } from "../src/infrastructure/logger";
import { withMaintenanceDatabase } from "./maintenance-database";
const mode = process.argv[2] ?? "inspect";
if (!["inspect", "activate", "rollback"].includes(mode)) throw new Error("Use inspect, activate or rollback");
if (mode !== "inspect" && !process.argv.includes("--writers-stopped")) throw new Error("Stop/drain all media and batch writers, then pass --writers-stopped");
await withMaintenanceDatabase(async database => {
 const repo = createBatchRunRepository(tx => (tx ?? database) as DrizzleExecutor);
 if (mode === "activate") logger.info(await repo.initialize(), "Batch cutover complete");
 else if (mode === "rollback") logger.info(await repo.rollback(), "Batch authority rolled back");
 else {
  const control = await database.select().from(schema.batchRunCutovers);
  const counts = await database.select({ status: schema.batchRuns.status, count: count() }).from(schema.batchRuns).groupBy(schema.batchRuns.status);
  const blocked = await database.select({ reason: schema.batchRuns.blockedReason, count: count() }).from(schema.batchRuns).where(eq(schema.batchRuns.status,"blocked")).groupBy(schema.batchRuns.blockedReason);
  const [legacy] = await database.select({ count: count() }).from(schema.jobs).where(inArray(schema.jobs.type,[...retiredBatchJobTypes]));
  logger.info({ control, counts, blocked, legacyCount: legacy?.count ?? 0 }, "Batch cutover inspection");
 }
});
