import { and, asc, count, eq, gt, inArray, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { ResourceConflictError } from "@solid-imager/core/domain/errors";
import {
	sourceRunSchema,
	retiredSourceJobTypes,
	type SourceRun,
	type SourceRunInput,
	type SourceRunKind,
} from "@solid-imager/core/domain/source-runs/schemas";
import { getSourceRunRevision } from "@solid-imager/core/domain/sources/run-revision";
import { sourceExportJobPayloadSchema } from "@solid-imager/core/domain/jobs/schemas";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import { isRecord } from "@solid-imager/core/utils/type-guards";
import {
	sourceRunCutovers as controls,
	sourceRunLegacySnapshots as archives,
	sourceSyncRuns as syncs,
	sourceTransferRuns as transfers,
	sourceRunLeases as owners,
	jobs,
	mediaSources,
} from "../schema";
import { createTransactionManager } from "../transaction-manager";
import type { DrizzleExecutor } from "../types";
const ID = "79100000-0000-4000-8000-000000000001";
const now = sql`timezone('UTC',clock_timestamp())`;
const tableFor = (kind: SourceRunKind) => (kind === "sync" ? syncs : transfers);
// Bun SQL encodes string parameters as JSON strings; cast JSON text through text.
function asJsonb(value: object | null) {
	if (value === null) return sql`NULL::jsonb`;
	const encoded = JSON.stringify(value);
	if (encoded === undefined) throw new Error("JSONB value is not serializable");
	return sql`${encoded}::text::jsonb`;
}
function rowsOf(value: unknown): unknown[] {
	return Array.isArray(value)
		? value
		: isRecord(value) && Array.isArray(value.rows)
			? value.rows
			: [];
}
const tuple = () =>
	sql`(${sql.join(
		retiredSourceJobTypes.map((type) => sql`${type}`),
		sql`,`,
	)})`;

export async function activateSourceRuns(
	getExecutor: (tx?: Transaction) => DrizzleExecutor,
): Promise<{ migrated: number; blocked: number }> {
	const [existing] = await getExecutor()
		.select()
		.from(controls)
		.where(eq(controls.id, ID));
	if (existing?.authority === "dedicated") return { migrated: 0, blocked: 0 };
	return createTransactionManager(() => getExecutor()).transaction(
		async (tx) => {
			const db = getExecutor(tx);
			await db.execute(sql`LOCK TABLE jobs IN SHARE ROW EXCLUSIVE MODE`);
			const [control] = await db
				.select()
				.from(controls)
				.where(eq(controls.id, ID))
				.for("update");
			if (control?.authority === "dedicated")
				return { migrated: 0, blocked: 0 };
			if (!control || control.generation !== 0)
				throw new ResourceConflictError(
					"Source cutover requires an initial legacy epoch",
				);
			const parentIds = db
				.select({ id: jobs.id })
				.from(jobs)
				.where(inArray(jobs.type, [...retiredSourceJobTypes]));
			const [foreignChild] = await db
				.select({ id: jobs.id })
				.from(jobs)
				.where(
					and(
						inArray(jobs.parentId, parentIds),
						notInArray(jobs.type, [...retiredSourceJobTypes]),
					),
				)
				.limit(1);
			if (foreignChild)
				throw new ResourceConflictError(
					"Classify foreign legacy source children before cutover",
				);
			const [total] = await db
				.select({ value: count() })
				.from(jobs)
				.where(inArray(jobs.type, [...retiredSourceJobTypes]));
			let cursor: string | undefined,
				blocked = 0;
			for (;;) {
				const rows = await db
					.select()
					.from(jobs)
					.where(
						and(
							inArray(jobs.type, [...retiredSourceJobTypes]),
							cursor ? gt(jobs.id, cursor) : undefined,
						),
					)
					.orderBy(asc(jobs.id))
					.limit(100);
				if (!rows.length) break;
				for (const row of rows) {
					const kind: SourceRunKind =
						row.type === "source_export"
							? "export"
							: row.type === "source_restore"
								? "restore"
								: "sync";
					const table = tableFor(kind);
					const [source] = row.mediaSourceId
						? await db
								.select()
								.from(mediaSources)
								.where(eq(mediaSources.id, row.mediaSourceId))
						: [];
					let input: SourceRunInput | null = null;
					let code: string | null = null;
					if (kind === "export") {
						const payload = sourceExportJobPayloadSchema.safeParse(row.payload);
						try {
							if (payload.success && source)
								input = {
									kind: "export",
									...payload.data,
									sourceRevision: getSourceRunRevision(
										source.type,
										source.connectionInfo,
									),
								};
							else code = "invalid_input";
						} catch {
							code = "invalid_input";
						}
					} else if (kind === "restore") {
						if (row.status !== "completed")
							code = "legacy_restore_uncheckpointed";
					} else if (!["completed", "cancelled", "failed"].includes(row.status))
						code = "legacy_retired_lancedb";
					if (
						!source &&
						!["completed", "cancelled", "failed"].includes(row.status)
					)
						code = "missing_source";
					const terminal = ["completed", "cancelled", "failed"].includes(
						row.status,
					);
					const status: SourceRun["status"] =
						code && !terminal
							? "blocked"
							: row.status === "completed"
								? "completed"
								: row.status === "cancelled"
									? "cancelled"
									: row.status === "failed"
										? "failed"
										: input
											? "pending"
											: "blocked";
					if (status === "blocked") blocked++;
					const artifact =
						row.artifactPath &&
						row.artifactFileName &&
						row.artifactContentType &&
						row.artifactExpiresAt
							? {
									path: row.artifactPath,
									fileName: row.artifactFileName,
									contentType: row.artifactContentType,
									size: row.artifactSize ?? 0,
									expiresAt: row.artifactExpiresAt,
								}
							: null;
					await db.insert(table).values({
						id: row.id,
						sourceId: row.mediaSourceId,
						kind,
						input: asJsonb(input),
						status,
						failureCode: code,
						artifact: asJsonb(artifact),
						retentionExpiresAt: row.artifactExpiresAt,
						attemptCount: row.attemptCount,
						maxAttempts: row.attemptCount + 3,
						cancelRequestedAt: row.cancelRequestedAt,
						createdAt: row.createdAt,
						updatedAt: row.updatedAt,
						startedAt: row.startedAt,
						finishedAt:
							terminal || status === "blocked"
								? (row.finishedAt ?? row.updatedAt)
								: null,
					});
					await db.execute(
						sql`INSERT INTO source_run_legacy_snapshots(id,kind,snapshot) SELECT id,${kind},to_jsonb(jobs) FROM jobs WHERE id=${row.id}::uuid`,
					);
				}
				cursor = rows.at(-1)?.id;
			}
			const [archived] = await db.select({ value: count() }).from(archives);
			const shadow = z
				.object({ value: z.coerce.number().int() })
				.parse(
					rowsOf(
						await db.execute(
							sql`SELECT count(*) AS value FROM jobs j WHERE j.type IN ${tuple()} AND NOT EXISTS(SELECT 1 FROM source_run_legacy_snapshots a WHERE a.id=j.id AND a.snapshot=to_jsonb(j))`,
						),
					)[0],
				);
			if (archived?.value !== total?.value || shadow.value)
				throw new ResourceConflictError(
					"Source backfill shadow comparison failed",
				);
			await db
				.delete(jobs)
				.where(inArray(jobs.type, [...retiredSourceJobTypes]));
			await db
				.update(controls)
				.set({ authority: "dedicated", generation: 1, updatedAt: now })
				.where(eq(controls.id, ID));
			return { migrated: total?.value ?? 0, blocked };
		},
	);
}

export async function rollbackSourceRuns(
	getExecutor: (tx?: Transaction) => DrizzleExecutor,
): Promise<{ restored: number }> {
	return createTransactionManager(() => getExecutor()).transaction(
		async (tx) => {
			const db = getExecutor(tx);
			await db.execute(sql`LOCK TABLE jobs IN SHARE ROW EXCLUSIVE MODE`);
			const [control] = await db
				.select()
				.from(controls)
				.where(eq(controls.id, ID))
				.for("update");
			if (control?.authority !== "dedicated")
				throw new ResourceConflictError(
					"Source rollback requires dedicated authority",
				);
			const [live] = await db
				.select({ value: count() })
				.from(owners)
				.where(gt(owners.expiresAt, now));
			if (live?.value)
				throw new ResourceConflictError(
					"Source owners must drain before rollback",
				);
			const [partial] = await db
				.select({ id: transfers.id })
				.from(transfers)
				.where(
					and(
						eq(transfers.kind, "restore"),
						inArray(transfers.status, ["pending", "in_progress", "failed"]),
						sql`((${transfers.checkpoint}->>'offset')::bigint > 0 OR (${transfers.checkpoint}->>'filesComplete')::boolean OR ${transfers.checkpoint}->>'fileCursor' IS NOT NULL)`,
					),
				)
				.limit(1);
			if (partial)
				throw new ResourceConflictError(
					"Complete or cancel a partially restored native run before rollback",
				);
			await db
				.update(controls)
				.set({
					authority: "legacy",
					generation: control.generation + 1,
					updatedAt: now,
				})
				.where(eq(controls.id, ID));
			let restored = 0;
			for (const table of [syncs, transfers]) {
				let cursor: string | undefined;
				for (;;) {
					const rows = await db
						.select()
						.from(table)
						.where(cursor ? gt(table.id, cursor) : undefined)
						.orderBy(asc(table.id))
						.limit(100);
					if (!rows.length) break;
					for (const row of rows) {
						const run = sourceRunSchema.parse(row);
						const [archive] = await db
							.select()
							.from(archives)
							.where(eq(archives.id, row.id));
						if (archive) {
							if (!isRecord(archive.snapshot))
								throw new ResourceConflictError("Invalid source archive");
							const original = archive.snapshot;
							const projected = {
								...original,
								parent_id: null,
								source_id: original.source_id ?? null,
								status:
									original.status === "completed"
										? "completed"
										: run.status === "blocked"
											? "failed"
											: run.status === "in_progress"
												? "pending"
												: run.status,
								artifact_path: run.artifact?.path ?? null,
								artifact_file_name: run.artifact?.fileName ?? null,
								artifact_content_type: run.artifact?.contentType ?? null,
								artifact_size: run.artifact?.size ?? null,
								artifact_expires_at: run.artifact?.expiresAt ?? null,
							};
							if (run.sourceId) {
								const [source] = await db
									.select({ id: mediaSources.id })
									.from(mediaSources)
									.where(eq(mediaSources.id, run.sourceId));
								if (!source) projected.source_id = null;
							}
							await db.execute(
								sql`INSERT INTO jobs SELECT * FROM jsonb_populate_record(NULL::jobs,${JSON.stringify(projected)}::jsonb)`,
							);
							restored++;
						} else if (run.kind !== "sync") {
							const input = run.input;
							const status =
								run.status === "blocked"
									? "failed"
									: run.status === "in_progress"
										? "pending"
										: run.status;
							const [source] = run.sourceId
								? await db
										.select({ id: mediaSources.id })
										.from(mediaSources)
										.where(eq(mediaSources.id, run.sourceId))
								: [];
							await db.insert(jobs).values({
								id: run.id,
								type:
									run.kind === "export" ? "source_export" : "source_restore",
								mediaSourceId: source?.id ?? null,
								status: !source && status === "pending" ? "failed" : status,
								payload:
									input && input.kind !== "sync"
										? input.kind === "export"
											? {
													mode: input.mode,
													includeImages: input.includeImages,
												}
											: { mode: input.mode, inputPath: input.inputPath }
										: null,
								attemptCount: run.attemptCount,
								createdAt: run.createdAt,
								updatedAt: run.updatedAt,
								cancelRequestedAt: run.cancelRequestedAt,
								startedAt: run.startedAt,
								finishedAt: run.finishedAt,
								artifactPath: run.artifact?.path ?? null,
								artifactFileName: run.artifact?.fileName ?? null,
								artifactContentType: run.artifact?.contentType ?? null,
								artifactSize: run.artifact?.size ?? null,
								artifactExpiresAt: run.artifact?.expiresAt ?? null,
							});
							restored++;
						}
					}
					cursor = rows.at(-1)?.id;
				}
			}
			// Restore links only after every archived row exists; UUID order is not parent order.
			await db.execute(
				sql`UPDATE jobs j SET parent_id=(a.snapshot->>'parent_id')::uuid FROM source_run_legacy_snapshots a WHERE j.id=a.id AND a.snapshot->>'parent_id' IS NOT NULL`,
			);
			for (const table of [syncs, transfers])
				await db
					.update(table)
					.set({
						status: "cancelled",
						leaseToken: null,
						leaseExpiresAt: null,
						cancelRequestedAt: now,
						updatedAt: now,
						finishedAt: now,
					})
					.where(inArray(table.status, ["pending", "in_progress"]));
			await db
				.update(owners)
				.set({ runId: null, kind: null, token: null, expiresAt: null });
			return { restored };
		},
	);
}
