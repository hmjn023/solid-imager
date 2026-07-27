import { sql } from "drizzle-orm";
import { z } from "zod";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { db } from "../src/infrastructure/db";
import { logger } from "../src/infrastructure/logger";

const auditRowSchema = z.object({
	relpersistence: z.enum(["p", "u"]),
	totalJobs: z.coerce.number().int().nonnegative(),
	tableBytes: z.coerce.number().int().nonnegative(),
	indexBytes: z.coerce.number().int().nonnegative(),
	totalBytes: z.coerce.number().int().nonnegative(),
	inProgressJobs: z.coerce.number().int().nonnegative(),
	missingQueueNames: z.coerce.number().int().nonnegative(),
	orphanParents: z.coerce.number().int().nonnegative(),
	duplicateActiveDedupeKeys: z.coerce.number().int().nonnegative(),
	duplicateRunningConcurrencyKeys: z.coerce.number().int().nonnegative(),
	invalidRetryRows: z.coerce.number().int().nonnegative(),
});

type Audit = z.infer<typeof auditRowSchema>;

const maxLockWaitMs = 5_000;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function firstRow(value: unknown): unknown {
	if (Array.isArray(value)) return value[0];
	if (isRecord(value) && Array.isArray(value.rows)) return value.rows[0];
	return undefined;
}

async function auditJobs(
	executor: Pick<DrizzleExecutor, "execute"> = db,
): Promise<Audit> {
	const result = await executor.execute(sql`
		SELECT
			class.relpersistence AS "relpersistence",
			(SELECT count(*) FROM jobs) AS "totalJobs",
			pg_relation_size(class.oid) AS "tableBytes",
			pg_indexes_size(class.oid) AS "indexBytes",
			pg_total_relation_size(class.oid) AS "totalBytes",
			(SELECT count(*) FROM jobs WHERE status = 'in_progress') AS "inProgressJobs",
			(SELECT count(*) FROM jobs WHERE queue_name IS NULL) AS "missingQueueNames",
			(SELECT count(*) FROM jobs child LEFT JOIN jobs parent ON parent.id = child.parent_id WHERE child.parent_id IS NOT NULL AND parent.id IS NULL) AS "orphanParents",
			(SELECT count(*) FROM (SELECT dedupe_key FROM jobs WHERE dedupe_key IS NOT NULL AND status IN ('pending', 'in_progress') GROUP BY dedupe_key HAVING count(*) > 1) duplicates) AS "duplicateActiveDedupeKeys",
			(SELECT count(*) FROM (SELECT concurrency_key FROM jobs WHERE concurrency_key IS NOT NULL AND status = 'in_progress' GROUP BY concurrency_key HAVING count(*) > 1) duplicates) AS "duplicateRunningConcurrencyKeys",
			(SELECT count(*) FROM jobs WHERE attempt_count < 0 OR max_attempts <= 0 OR lease_duration_ms <= 0) AS "invalidRetryRows"
		FROM pg_class class
		INNER JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
		WHERE class.relname = 'jobs' AND namespace.nspname = current_schema()
	`);
	return auditRowSchema.parse(firstRow(result));
}

function assertReadyForRewrite(audit: Audit): void {
	if (audit.inProgressJobs > 0) {
		throw new Error(
			`Jobs are not quiesced: ${audit.inProgressJobs} job(s) are in_progress`,
		);
	}
	const invalidRows =
		audit.missingQueueNames +
		audit.orphanParents +
		audit.duplicateActiveDedupeKeys +
		audit.duplicateRunningConcurrencyKeys +
		audit.invalidRetryRows;
	if (invalidRows > 0) {
		throw new Error(
			`Jobs validation failed with ${invalidRows} row/group violation(s)`,
		);
	}
}

function isReadyForRewrite(audit: Audit): boolean {
	try {
		assertReadyForRewrite(audit);
		return true;
	} catch {
		return false;
	}
}

async function main(): Promise<void> {
	const startedAt = new Date();
	const startedAtMs = Date.now();
	const args = new Set(process.argv.slice(2));
	const apply = args.has("--apply");
	if (args.size > (apply ? 2 : 0)) {
		throw new Error(
			"Usage: bun scripts/set-jobs-logged.ts [--apply --confirm-jobs-quiesced]",
		);
	}
	if (process.env.DB_HOST === "pglite") {
		throw new Error("SET LOGGED maintenance is only valid for PostgreSQL");
	}
	const before = await auditJobs();
	if (!apply) {
		const finishedAt = new Date();
		process.stdout.write(
			`${JSON.stringify(
				{
					mode: "dry-run",
					ready: isReadyForRewrite(before),
					startedAt: startedAt.toISOString(),
					finishedAt: finishedAt.toISOString(),
					elapsedMs: Date.now() - startedAtMs,
					maxLockWaitMs,
					before,
				},
				null,
				2,
			)}\n`,
		);
		return;
	}
	if (!args.has("--confirm-jobs-quiesced")) {
		throw new Error("--apply requires --confirm-jobs-quiesced");
	}
	assertReadyForRewrite(before);
	let rewriteElapsedMs = 0;
	if (before.relpersistence === "u") {
		const rewriteStartedAtMs = Date.now();
		await db.transaction(async (transaction) => {
			await transaction.execute(sql`SET LOCAL lock_timeout = '5s'`);
			await transaction.execute(
				sql`SELECT pg_advisory_xact_lock(hashtext('solid-imager.jobs.set-logged'))`,
			);
			assertReadyForRewrite(await auditJobs(transaction));
			await transaction.execute(sql`ALTER TABLE jobs SET LOGGED`);
		});
		rewriteElapsedMs = Date.now() - rewriteStartedAtMs;
	}
	const after = await auditJobs();
	if (after.relpersistence !== "p") {
		throw new Error("jobs relpersistence did not become permanent");
	}
	logger.info(
		{
			totalJobs: after.totalJobs,
			tableBytes: after.tableBytes,
			indexBytes: after.indexBytes,
			totalBytes: after.totalBytes,
			rewriteElapsedMs,
		},
		"jobs table is WAL-logged and validated",
	);
	const finishedAt = new Date();
	process.stdout.write(
		`${JSON.stringify(
			{
				mode: "apply",
				changed: before.relpersistence === "u",
				startedAt: startedAt.toISOString(),
				finishedAt: finishedAt.toISOString(),
				elapsedMs: Date.now() - startedAtMs,
				rewriteElapsedMs,
				maxLockWaitMs,
				before,
				after,
			},
			null,
			2,
		)}\n`,
	);
}

main().catch((error: unknown) => {
	logger.error({ err: error }, "SET LOGGED maintenance failed");
	process.exitCode = 1;
});
