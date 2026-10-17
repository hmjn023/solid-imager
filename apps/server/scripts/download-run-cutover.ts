import { count, eq, sql } from "drizzle-orm";
import { createDownloadRunRepository } from "@solid-imager/db/repositories/download-run-repository";
import * as schema from "@solid-imager/db/schema";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { logger } from "../src/infrastructure/logger";
import { withMaintenanceDatabase } from "./maintenance-database";

const mode = process.argv[2] ?? "inspect";
if (!["inspect", "activate", "rollback"].includes(mode))
	throw new Error("Use inspect, activate or rollback");
if (mode !== "inspect" && !process.argv.includes("--writers-stopped"))
	throw new Error(
		"Stop/drain download producers and workers, then pass --writers-stopped",
	);
await withMaintenanceDatabase(async (database) => {
	// Only the owned Drizzle connection/transactions enter the opaque core transaction port.
	const repo = createDownloadRunRepository(
		(tx) => (tx ?? database) as DrizzleExecutor,
	);
	if (mode === "activate")
		logger.info(await repo.ensureCutover(), "Download run cutover complete");
	else if (mode === "rollback")
		logger.info(
			{ restored: await repo.rollback() },
			"Download authority rolled back",
		);
	else {
		const control = await database.select().from(schema.downloadRunCutovers);
		const counts = await database
			.select({ status: schema.downloadRuns.status, count: count() })
			.from(schema.downloadRuns)
			.groupBy(schema.downloadRuns.status);
		const blocked = await database
			.select({ reason: schema.downloadRuns.blockedReason, count: count() })
			.from(schema.downloadRuns)
			.where(eq(schema.downloadRuns.status, "blocked"))
			.groupBy(schema.downloadRuns.blockedReason);
		const [legacy] = await database
			.select({ count: count() })
			.from(schema.jobs)
			.where(eq(schema.jobs.type, "downloadImage"));
		const [leases] = await database
			.select({ count: count() })
			.from(schema.downloadRuns)
			.where(
				sql`${schema.downloadRuns.status} = 'in_progress' AND ${schema.downloadRuns.leaseExpiresAt} > timezone('UTC', clock_timestamp())`,
			);
		logger.info(
			{
				control,
				counts,
				blocked,
				legacyCount: legacy?.count ?? 0,
				liveLeases: leases?.count ?? 0,
			},
			"Download run cutover inspection",
		);
	}
});
