import { count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { ResourceConflictError } from "@solid-imager/core/domain/errors";
import {
	legacyJobAuditSchema,
	retiredGenericJobTypes,
	jobActivitySampleSchema,
	type LegacyJobAudit,
} from "@solid-imager/core/domain/jobs/schemas";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import { isRecord } from "@solid-imager/core/utils/type-guards";
import {
	jobs,
	jobRuntimeCutovers,
	importRequestCutovers,
	downloadRunCutovers,
	batchRunCutovers,
	sourceRunCutovers,
} from "../schema";
import { createTransactionManager } from "../transaction-manager";
import type { DrizzleExecutor } from "../types";

const ID = "79200000-0000-4000-8000-000000000001";
const now = sql`timezone('UTC',clock_timestamp())`;
function rowsOf(value: unknown): unknown[] {
	return Array.isArray(value)
		? value
		: isRecord(value) && Array.isArray(value.rows)
			? value.rows
			: [];
}
function scalar(value: unknown) {
	return z
		.object({ value: z.coerce.number().int().nonnegative() })
		.parse(rowsOf(value)[0]).value;
}
export function createJobRetirementRepository(
	getExecutor: (tx?: Transaction) => DrizzleExecutor,
) {
	const transactions = createTransactionManager(() => getExecutor());
	async function authorities(tx?: Transaction) {
		const values = [];
		for (const [family, table] of [
			["imports", importRequestCutovers],
			["downloads", downloadRunCutovers],
			["batches", batchRunCutovers],
			["sources", sourceRunCutovers],
		] as const) {
			const rows = await getExecutor(tx)
				.select({ authority: table.authority, generation: table.generation })
				.from(table)
				.for("share");
			for (const row of rows) values.push({ family, ...row });
		}
		return values;
	}
	async function inspect(tx?: Transaction): Promise<LegacyJobAudit> {
		const db = getExecutor(tx),
			[control] = await db
				.select()
				.from(jobRuntimeCutovers)
				.where(eq(jobRuntimeCutovers.id, ID));
		const types = await db
			.select({ type: jobs.type, status: jobs.status, count: count() })
			.from(jobs)
			.groupBy(jobs.type, jobs.status);
		const known = new Set<string>(retiredGenericJobTypes);
		const brokenParents = scalar(
			await db.execute(
				sql`SELECT count(*) AS value FROM jobs child LEFT JOIN jobs parent ON parent.id=child.parent_id WHERE child.parent_id IS NOT NULL AND (parent.id IS NULL OR (child.status IN ('pending','in_progress') AND parent.status IN ('completed','failed','cancelled')))`,
			),
		);
		const crossFamilyChildren = scalar(
			await db.execute(
				sql`SELECT count(*) AS value FROM jobs child JOIN jobs parent ON parent.id=child.parent_id WHERE legacy_job_family(child.type)<>legacy_job_family(parent.type)`,
			),
		);
		const missingArchives = scalar(
			await db.execute(sql`SELECT
   (SELECT count(*) FROM import_request_legacy_snapshots a LEFT JOIN import_requests r ON r.id=a.request_id WHERE r.id IS NULL) +
   (SELECT count(*) FROM download_run_legacy_snapshots a LEFT JOIN download_runs r ON r.id=a.run_id WHERE r.id IS NULL) +
   (SELECT count(*) FROM batch_run_legacy_snapshots a LEFT JOIN batch_runs r ON r.id=a.run_id WHERE r.id IS NULL) +
   (SELECT count(*) FROM source_run_legacy_snapshots a LEFT JOIN source_sync_runs s ON s.id=a.id LEFT JOIN source_transfer_runs t ON t.id=a.id WHERE s.id IS NULL AND t.id IS NULL) AS value`),
		);
		const archiveCounts: Record<string, number> = {};
		for (const [family, table] of [
			["imports", "import_request_legacy_snapshots"],
			["downloads", "download_run_legacy_snapshots"],
			["batches", "batch_run_legacy_snapshots"],
			["sources", "source_run_legacy_snapshots"],
		] as const)
			archiveCounts[family] = scalar(
				await db.execute(
					sql`SELECT count(*) AS value FROM ${sql.identifier(table)}`,
				),
			);
		return legacyJobAuditSchema.parse({
			authority: control?.authority ?? "legacy",
			generation: control?.generation ?? 0,
			types: types.map((row) => ({ ...row, known: known.has(row.type) })),
			authorities: await authorities(tx),
			active: types
				.filter((row) => ["pending", "in_progress"].includes(row.status))
				.reduce((n, row) => n + row.count, 0),
			brokenParents,
			crossFamilyChildren,
			missingArchives,
			archiveCounts,
		});
	}
	return {
		inspect,
		async preflight() {
			const [control] = await getExecutor()
				.select()
				.from(jobRuntimeCutovers)
				.where(eq(jobRuntimeCutovers.id, ID));
			if (control?.authority === "retired") return;
			if (!control || control.generation !== 0)
				throw new ResourceConflictError(
					"Review the restored legacy epoch before reactivation",
				);
			const audit = await inspect();
			if (
				audit.types.some((row) => !row.known) ||
				audit.crossFamilyChildren ||
				audit.brokenParents ||
				audit.missingArchives
			)
				throw new ResourceConflictError(
					"Classify unknown legacy types, parent links and archives before any flow cutover",
				);
		},
		async assertRetired() {
			const [control] = await getExecutor()
				.select()
				.from(jobRuntimeCutovers)
				.where(eq(jobRuntimeCutovers.id, ID));
			if (control?.authority !== "retired")
				throw new ResourceConflictError(
					"Generic jobs retirement must be activated before observation",
				);
		},
		async initialize() {
			const [existing] = await getExecutor()
				.select()
				.from(jobRuntimeCutovers)
				.where(eq(jobRuntimeCutovers.id, ID));
			// No reads of jobs on normal startup once this one-time gate has passed.
			if (existing?.authority === "retired") return;
			await transactions.transaction(async (tx) => {
				const db = getExecutor(tx);
				await db.execute(sql`LOCK TABLE jobs IN SHARE ROW EXCLUSIVE MODE`);
				const [control] = await db
					.select()
					.from(jobRuntimeCutovers)
					.where(eq(jobRuntimeCutovers.id, ID))
					.for("update");
				if (control?.authority === "retired") return;
				if (!control || control.generation !== 0)
					throw new ResourceConflictError(
						"Generic jobs retirement requires an initial legacy epoch",
					);
				const audit = await inspect(tx);
				if (
					audit.authorities.length !== 4 ||
					audit.authorities.some((row) => row.authority !== "dedicated")
				)
					throw new ResourceConflictError(
						"Complete every dedicated flow cutover before retiring generic jobs",
					);
				if (audit.types.length || audit.brokenParents || audit.missingArchives)
					throw new ResourceConflictError(
						"Generic jobs audit is not empty; classify legacy types and reconcile archives before startup",
					);
				await db
					.update(jobRuntimeCutovers)
					.set({ authority: "retired", generation: 1, updatedAt: now })
					.where(eq(jobRuntimeCutovers.id, ID));
			});
		},
		async rollback() {
			await transactions.transaction(async (tx) => {
				const db = getExecutor(tx);
				await db.execute(sql`LOCK TABLE jobs IN SHARE ROW EXCLUSIVE MODE`);
				const [control] = await db
					.select()
					.from(jobRuntimeCutovers)
					.where(eq(jobRuntimeCutovers.id, ID))
					.for("update");
				if (control?.authority !== "retired")
					throw new ResourceConflictError("Generic jobs are not retired");
				const live = scalar(
					await db.execute(sql`SELECT
     (SELECT count(*) FROM source_run_leases WHERE expires_at>${now})+
     (SELECT count(*) FROM download_runs WHERE lease_expires_at>${now})+
     (SELECT count(*) FROM batch_runs WHERE lease_expires_at>${now})+
     (SELECT count(*) FROM media_processing_states WHERE status='in_progress' AND heartbeat_at>${now}-interval '120 seconds') AS value`),
				);
				if (live)
					throw new ResourceConflictError(
						"Drain every dedicated lease before releasing the generic write fence",
					);
				await db
					.update(jobRuntimeCutovers)
					.set({
						authority: "legacy",
						generation: control.generation + 1,
						updatedAt: now,
					})
					.where(eq(jobRuntimeCutovers.id, ID));
			});
		},
		async sampleActivity() {
			// Catalog counters only: sampling itself must not read jobs or reset statistics.
			const result = await getExecutor()
				.execute(sql`SELECT clock_timestamp() AS "sampledAt",current_database() AS database,
    d.datid::text AS "databaseOid",s.relid::text AS "tableOid",pg_postmaster_start_time() AS "serverStartedAt",d.stats_reset AS "statsResetAt",current_setting('track_counts')='on' AS "trackCounts",
    (s.seq_scan+coalesce(s.idx_scan,0))::double precision AS scans,s.n_tup_ins::double precision AS inserted,s.n_tup_upd::double precision AS updated,s.n_tup_del::double precision AS deleted
    FROM pg_stat_user_tables s CROSS JOIN pg_stat_database d WHERE s.relid='jobs'::regclass AND d.datname=current_database()`);
			return jobActivitySampleSchema.parse(rowsOf(result)[0]);
		},
	};
}
