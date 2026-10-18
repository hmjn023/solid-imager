import { randomUUID } from "node:crypto";
import {
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	inArray,
	isNull,
	or,
	sql,
} from "drizzle-orm";
import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import { isRecord } from "@solid-imager/core/utils/type-guards";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { IDownloadRunRepository } from "@solid-imager/core/domain/repositories/download-run-repository";
import {
	downloadInputSchema,
	downloadRunSchema,
	downloadClaimSchema,
	downloadRegistrationCheckpointSchema,
	DownloadAttemptLostError,
	DownloadCancelledError,
	type DownloadInput,
	type DownloadClaim,
	type DownloadRun,
	type DownloadRunStatus,
	type DownloadBlockedReason,
} from "@solid-imager/core/domain/downloads/schemas";
import {
	downloadRunCutovers as controls,
	downloadRuns as runs,
	downloadRunLegacySnapshots as archives,
	jobs,
	mediaSources,
} from "../schema";
import { createTransactionManager } from "../transaction-manager";
import { canonicalJsonHash } from "../utils/canonical-json";
import type { DrizzleExecutor } from "../types";

const CONTROL_ID = "78900000-0000-4000-8000-000000000001";
export const DOWNLOAD_LEASE_MS = 120_000;
// Schema timestamp columns are UTC without time zone; never compare a JS Date in untyped SQL.
const now = sql`timezone('UTC', clock_timestamp())`;
const nextLease = sql`${now} + ${DOWNLOAD_LEASE_MS} * interval '1 millisecond'`;
const clearLease = { leaseToken: null, leaseExpiresAt: null };
const hashInputSchema = downloadInputSchema.omit({ importRequestId: true });
function key(input: DownloadInput) {
	// Legacy queue producers materialized an empty description, equivalent to omission during execution.
	return canonicalJsonHash(
		hashInputSchema.parse({ ...input, description: input.description ?? "" }),
	);
}
function decode(value: unknown): unknown {
	if (typeof value !== "string") return value;
	try {
		const decoded: unknown = JSON.parse(value);
		return decoded;
	} catch {
		return value;
	}
}
function map(row: typeof runs.$inferSelect): DownloadRun {
	return downloadRunSchema.parse({
		id: row.id,
		mediaSourceId: row.mediaSourceId,
		sourcePath: row.sourcePath,
		input: row.input,
		requestKey: row.requestKey,
		importRequestId: row.importRequestId,
		status: row.status,
		canonicalId: row.canonicalId,
		blockedReason: row.blockedReason,
		attemptCount: row.attemptCount,
		maxAttempts: row.maxAttempts,
		leaseToken: row.leaseToken,
		leaseExpiresAt: row.leaseExpiresAt,
		nextRunAt: row.nextRunAt,
		checkpoint: row.checkpoint,
		result: row.result,
		error: row.error,
		parentId: row.parentId,
		cancelRequestedAt: row.cancelRequestedAt,
		cancelledAt: row.cancelledAt,
		startedAt: row.startedAt,
		finishedAt: row.finishedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});
}
function currentClaim(claim: DownloadClaim) {
	return and(
		eq(runs.id, claim.id),
		eq(runs.status, "in_progress"),
		eq(runs.leaseToken, claim.leaseToken),
		eq(runs.attemptCount, claim.attemptCount),
		sql`${runs.leaseExpiresAt} > ${now}`,
	);
}
function isUniqueConflict(error: unknown): boolean {
	if (!isRecord(error)) return false;
	return (
		(error.code === "23505" && error.constraint === "uq_download_active_key") ||
		isUniqueConflict(error.cause)
	);
}

export function createDownloadRunRepository(
	getExecutor: (tx?: Transaction) => DrizzleExecutor,
): IDownloadRunRepository {
	const transactions = createTransactionManager(() => getExecutor());
	async function assertDedicated(tx: Transaction) {
		const [control] = await getExecutor(tx)
			.select()
			.from(controls)
			.where(eq(controls.id, CONTROL_ID))
			.for("share");
		if (control?.authority !== "dedicated")
			throw new ResourceConflictError("Dedicated download writes are disabled");
	}
	async function locked(claim: DownloadClaim, tx: Transaction) {
		await assertDedicated(tx);
		const db = getExecutor(tx);
		const [row] = await db
			.select()
			.from(runs)
			.where(currentClaim(claim))
			.for("update");
		if (!row) throw new DownloadAttemptLostError();
		if (row.cancelRequestedAt) throw new DownloadCancelledError();
		const [source] = row.mediaSourceId
			? await db
					.select()
					.from(mediaSources)
					.where(eq(mediaSources.id, row.mediaSourceId))
					.for("share")
			: [];
		const connection = localConnectionSchema.safeParse(source?.connectionInfo);
		if (
			source?.type !== "local" ||
			!connection.success ||
			connection.data.path !== row.sourcePath
		)
			throw new ResourceConflictError("Download target source changed");
		return row;
	}
	return {
		assertDedicated,
		async ensureCutover() {
			const [existing] = await getExecutor()
				.select()
				.from(controls)
				.where(eq(controls.id, CONTROL_ID));
			if (existing?.authority === "dedicated")
				return { migrated: 0, blocked: 0, aliases: 0 };
			return transactions.transaction(async (tx) => {
				const db = getExecutor(tx);
				const [control] = await db
					.select()
					.from(controls)
					.where(eq(controls.id, CONTROL_ID))
					.for("update");
				if (!control)
					throw new ResourceConflictError(
						"Download migration has not been applied",
					);
				if (control.authority === "dedicated")
					return { migrated: 0, blocked: 0, aliases: 0 };
				if (control.generation > 0)
					throw new ResourceConflictError(
						"Downloads are rolled back; dedicated writes are disabled",
					);
				// Only activate after old/new producers and workers have been stopped and drained.
				await db.execute(sql`LOCK TABLE jobs IN SHARE ROW EXCLUSIVE MODE`);
				let cursor: string | undefined;
				let migrated = 0;
				for (;;) {
					const rows = await db
						.select()
						.from(jobs)
						.where(
							and(
								eq(jobs.type, "downloadImage"),
								cursor ? gt(jobs.id, cursor) : undefined,
							),
						)
						.orderBy(asc(jobs.id))
						.limit(250)
						.for("update");
					if (!rows.length) break;
					for (const row of rows) {
						const payload = decode(row.payload);
						const parsed = downloadInputSchema.safeParse(payload);
						const input = parsed.success ? parsed.data : null;
						const rawCheckpoint = isRecord(payload)
							? payload.downloadRegistration
							: undefined;
						const parsedCheckpoint =
							rawCheckpoint === undefined
								? null
								: downloadRegistrationCheckpointSchema.safeParse(rawCheckpoint);
						const checkpoint = parsedCheckpoint?.success
							? parsedCheckpoint.data
							: null;
						const [source] = row.mediaSourceId
							? await db
									.select()
									.from(mediaSources)
									.where(eq(mediaSources.id, row.mediaSourceId))
							: [];
						const connection = localConnectionSchema.safeParse(
							source?.connectionInfo,
						);
						const sourcePath =
							source?.type === "local" && connection.success
								? connection.data.path
								: null;
						let blockedReason: DownloadBlockedReason | null = !input
							? "invalid_input"
							: parsedCheckpoint && !parsedCheckpoint.success
								? "invalid_checkpoint"
								: !sourcePath ||
									  (checkpoint &&
											(checkpoint.mediaSourceId !== row.mediaSourceId ||
												checkpoint.sourcePath !== sourcePath))
									? "invalid_source"
									: row.parentId &&
										  ["pending", "in_progress"].includes(row.status)
										? "legacy_parent"
										: null;
						const knownStatus = [
							"pending",
							"in_progress",
							"completed",
							"failed",
							"cancelled",
						].includes(row.status);
						if (!knownStatus) blockedReason = "invalid_input";
						let status: DownloadRunStatus = blockedReason
							? "blocked"
							: row.status === "in_progress"
								? "pending"
								: row.status;
						if (row.cancelRequestedAt && status === "pending")
							status = "cancelled";
						const values = {
							nextRunAt: now,
							id: row.id,
							mediaSourceId: row.mediaSourceId,
							sourcePath,
							input,
							requestKey: input ? key(input) : `invalid:${row.id}`,
							importRequestId: null,
							status,
							blockedReason,
							checkpoint,
							parentId: row.parentId,
							attemptCount: row.attemptCount ?? 0,
							maxAttempts: Math.max(3, (row.attemptCount ?? 0) + 3),
							error: row.error,
							createdAt: row.createdAt,
							updatedAt: row.updatedAt,
							startedAt: row.startedAt,
							finishedAt: row.finishedAt,
							cancelRequestedAt: row.cancelRequestedAt,
							cancelledAt:
								status === "cancelled"
									? (row.cancelledAt ?? row.updatedAt)
									: row.cancelledAt,
						};
						let [stored] = await db
							.insert(runs)
							.values(values)
							.onConflictDoNothing()
							.returning();
						if (!stored) {
							const [sameId] = await db
								.select({ id: runs.id })
								.from(runs)
								.where(eq(runs.id, row.id));
							if (sameId)
								throw new ResourceConflictError(
									"Legacy download ID conflicts with dedicated state",
								);
							const [canonical] = row.mediaSourceId
								? await db
										.select()
										.from(runs)
										.where(
											and(
												eq(runs.mediaSourceId, row.mediaSourceId),
												eq(runs.requestKey, values.requestKey),
												inArray(runs.status, ["pending", "in_progress"]),
											),
										)
								: [];
							if (!canonical || status !== "pending")
								throw new ResourceConflictError(
									"Legacy download could not be reconciled",
								);
							if (checkpoint) {
								await db
									.update(runs)
									.set({
										status: "blocked",
										blockedReason: "ambiguous_registration",
										...clearLease,
									})
									.where(eq(runs.id, canonical.id));
								[stored] = await db
									.insert(runs)
									.values({
										...values,
										status: "blocked",
										blockedReason: "ambiguous_registration",
									})
									.returning();
							} else
								[stored] = await db
									.insert(runs)
									.values({
										...values,
										status: "superseded",
										canonicalId: canonical.id,
										finishedAt: now,
									})
									.returning();
						}
						// Shadow comparison while authority is still legacy; fail before deleting any original row.
						const projected = map(stored);
						if (
							projected.id !== row.id ||
							projected.mediaSourceId !== row.mediaSourceId ||
							projected.sourcePath !== sourcePath ||
							(input &&
								(!projected.input ||
									canonicalJsonHash(input) !==
										canonicalJsonHash(projected.input))) ||
							(checkpoint &&
								(!projected.checkpoint ||
									canonicalJsonHash(checkpoint) !==
										canonicalJsonHash(projected.checkpoint)))
						)
							throw new ResourceConflictError(
								"Download backfill shadow mismatch",
							);
						migrated++;
					}
					cursor = rows.at(-1)?.id;
				}
				// An invalid/ambiguous saved registration must not let an equivalent empty run redownload it.
				await db.execute(
					sql`UPDATE download_runs AS active SET status = 'blocked', blocked_reason = 'ambiguous_registration', lease_token = NULL, lease_expires_at = NULL WHERE active.status IN ('pending', 'in_progress') AND EXISTS (SELECT 1 FROM download_runs AS blocked WHERE blocked.source_id = active.source_id AND blocked.request_key = active.request_key AND blocked.blocked_reason IN ('invalid_checkpoint', 'ambiguous_registration'))`,
				);
				await db.execute(
					sql`INSERT INTO download_run_legacy_snapshots (run_id, snapshot) SELECT id, to_jsonb(jobs) FROM jobs WHERE type = 'downloadImage'`,
				);
				const [snapshots] = await db
					.select({ total: count() })
					.from(archives)
					.innerJoin(jobs, eq(archives.runId, jobs.id))
					.where(eq(jobs.type, "downloadImage"));
				const [mismatches] = await db
					.select({ total: count() })
					.from(archives)
					.innerJoin(jobs, eq(archives.runId, jobs.id))
					.where(
						and(
							eq(jobs.type, "downloadImage"),
							sql`${archives.snapshot} <> to_jsonb(${jobs})`,
						),
					);
				if (snapshots.total !== migrated || mismatches.total)
					throw new ResourceConflictError("Download snapshot shadow mismatch");
				const [blocked] = await db
					.select({ total: count() })
					.from(runs)
					.innerJoin(archives, eq(archives.runId, runs.id))
					.where(eq(runs.status, "blocked"));
				const [aliases] = await db
					.select({ total: count() })
					.from(runs)
					.innerJoin(archives, eq(archives.runId, runs.id))
					.where(eq(runs.status, "superseded"));
				await db.delete(jobs).where(eq(jobs.type, "downloadImage"));
				await db
					.update(controls)
					.set({ authority: "dedicated", generation: 1, updatedAt: now })
					.where(eq(controls.id, CONTROL_ID));
				return { migrated, blocked: blocked.total, aliases: aliases.total };
			});
		},
		async rollback() {
			return transactions.transaction(async (tx) => {
				const db = getExecutor(tx);
				const [control] = await db
					.select()
					.from(controls)
					.where(eq(controls.id, CONTROL_ID))
					.for("update");
				if (!control || control.authority !== "dedicated") return 0;
				const [live] = await db
					.select({ total: count() })
					.from(runs)
					.where(
						and(
							eq(runs.status, "in_progress"),
							sql`${runs.leaseExpiresAt} > ${now}`,
						),
					);
				if (live.total)
					throw new ResourceConflictError(
						"Download workers still hold live leases",
					);
				await db.execute(sql`LOCK TABLE jobs IN SHARE ROW EXCLUSIVE MODE`);
				await db
					.update(controls)
					.set({
						authority: "legacy",
						generation: control.generation + 1,
						updatedAt: now,
					})
					.where(eq(controls.id, CONTROL_ID));
				await db.execute(sql`
					INSERT INTO jobs SELECT (restored.record).* FROM (
						SELECT jsonb_populate_record(NULL::jobs, archive.snapshot || jsonb_build_object(
							'status', CASE run.status WHEN 'superseded' THEN CASE WHEN canonical.status = 'completed' THEN 'completed' ELSE 'cancelled' END WHEN 'blocked' THEN CASE WHEN archive.snapshot->>'status' IN ('completed', 'cancelled') THEN archive.snapshot->>'status' ELSE 'failed' END WHEN 'in_progress' THEN 'pending' ELSE run.status END,
							'source_id', run.source_id, 'attempt_count', run.attempt_count,
							'payload', CASE WHEN run.checkpoint IS NULL THEN archive.snapshot->'payload' ELSE (CASE jsonb_typeof(archive.snapshot->'payload') WHEN 'object' THEN archive.snapshot->'payload' WHEN 'string' THEN (archive.snapshot->>'payload')::jsonb ELSE coalesce(run.input, '{}'::jsonb) END) || jsonb_build_object('downloadRegistration', run.checkpoint) END,
							'updated_at', ${now}, 'cancel_requested_at', run.cancel_requested_at, 'cancelled_at', run.cancelled_at,
							'started_at', run.started_at, 'finished_at', run.finished_at,
							'error', run.error, 'result', coalesce(to_jsonb(run.result), archive.snapshot->'result')
						)) AS record
						FROM download_run_legacy_snapshots archive JOIN download_runs run ON run.id = archive.run_id LEFT JOIN download_runs canonical ON canonical.id = run.canonical_id
					) restored
				`);
				const rows = await db.select().from(runs).orderBy(asc(runs.id));
				const archived = new Set(
					(await db.select({ id: archives.runId }).from(archives)).map(
						(row) => row.id,
					),
				);
				for (const row of rows) {
					if (archived.has(row.id)) continue;
					const run = map(row);
					if (!run.input)
						throw new ResourceConflictError(
							"Native download has no restorable input",
						);
					await db.insert(jobs).values({
						id: run.id,
						type: "downloadImage",
						mediaSourceId: run.mediaSourceId,
						status:
							run.status === "superseded"
								? "cancelled"
								: run.status === "blocked"
									? "failed"
									: run.status === "in_progress"
										? "pending"
										: run.status,
						payload: {
							...run.input,
							...(run.checkpoint
								? { downloadRegistration: run.checkpoint }
								: {}),
						},
						result: run.result,
						attemptCount: run.attemptCount,
						parentId: run.parentId,
						error: run.error,
						cancelRequestedAt: run.cancelRequestedAt,
						cancelledAt: run.cancelledAt,
						startedAt: run.startedAt,
						finishedAt: run.finishedAt,
						createdAt: run.createdAt,
						updatedAt: now,
					});
				}
				return rows.length;
			});
		},
		async reserve(sourceId, items, tx) {
			await assertDedicated(tx);
			const db = getExecutor(tx);
			const [source] = await db
				.select()
				.from(mediaSources)
				.where(eq(mediaSources.id, sourceId))
				.for("share");
			if (!source) throw new ResourceNotFoundError("Download source", sourceId);
			const connection = localConnectionSchema.safeParse(source.connectionInfo);
			if (source.type !== "local" || !connection.success)
				throw new ResourceConflictError(
					"Downloads require a local target source",
				);
			let created = 0;
			const receipts: string[] = [];
			for (const candidate of items) {
				const input = downloadInputSchema.parse(candidate);
				const values = {
					nextRunAt: now,
					createdAt: now,
					updatedAt: now,
					mediaSourceId: sourceId,
					sourcePath: connection.data.path,
					input,
					requestKey: key(input),
					importRequestId: input.importRequestId ?? null,
				};
				const [inserted] = await db
					.insert(runs)
					.values(values)
					.onConflictDoNothing()
					.returning();
				if (inserted) {
					created++;
					receipts.push(inserted.id);
					continue;
				}
				const [receipt] = input.importRequestId
					? await db
							.select()
							.from(runs)
							.where(eq(runs.importRequestId, input.importRequestId))
					: [];
				if (receipt) {
					receipts.push(receipt.id);
					continue;
				}
				const [canonical] = await db
					.select()
					.from(runs)
					.where(
						and(
							eq(runs.mediaSourceId, sourceId),
							eq(runs.requestKey, values.requestKey),
							inArray(runs.status, ["pending", "in_progress"]),
						),
					)
					.for("share");
				if (!canonical) {
					// A terminal transition released the key between conflict detection and this lookup.
					const [fresh] = await db.insert(runs).values(values).returning();
					created++;
					receipts.push(fresh.id);
					continue;
				}
				const [alias] = await db
					.insert(runs)
					.values({
						...values,
						status: "superseded",
						canonicalId: canonical.id,
						finishedAt: now,
					})
					.returning();
				receipts.push(alias.id);
			}
			return { created, receipts };
		},
		async findById(id, tx) {
			const [row] = await getExecutor(tx)
				.select()
				.from(runs)
				.where(eq(runs.id, id));
			return row ? map(row) : null;
		},
		async findByIds(ids, tx) {
			return ids.length
				? (
						await getExecutor(tx)
							.select()
							.from(runs)
							.where(inArray(runs.id, ids))
					).map(map)
				: [];
		},
		async list(input, tx) {
			await assertDedicated(tx);
			const where = and(
				input.status ? eq(runs.status, input.status) : undefined,
				input.mediaSourceId
					? eq(runs.mediaSourceId, input.mediaSourceId)
					: undefined,
			);
			const rows = await getExecutor(tx)
				.select()
				.from(runs)
				.where(where)
				.orderBy(desc(runs.createdAt), desc(runs.id))
				.limit(input.limit)
				.offset(input.offset);
			const [total] = await getExecutor(tx)
				.select({ total: count() })
				.from(runs)
				.where(where);
			return { items: rows.map(map), total: total.total };
		},
		async claimPending(limit) {
			if (limit <= 0) return [];
			return transactions.transaction(async (tx) => {
				await assertDedicated(tx);
				const db = getExecutor(tx);
				const due = await db
					.select()
					.from(runs)
					.where(
						or(
							and(eq(runs.status, "pending"), sql`${runs.nextRunAt} <= ${now}`),
							and(
								eq(runs.status, "in_progress"),
								sql`${runs.leaseExpiresAt} <= ${now}`,
							),
						),
					)
					.orderBy(asc(runs.nextRunAt), asc(runs.createdAt), asc(runs.id))
					.limit(limit)
					.for("update", { skipLocked: true });
				const claims: DownloadClaim[] = [];
				for (const row of due) {
					if (row.cancelRequestedAt || row.attemptCount >= row.maxAttempts) {
						await db
							.update(runs)
							.set({
								status: row.cancelRequestedAt ? "cancelled" : "failed",
								...clearLease,
								cancelledAt: row.cancelRequestedAt ? now : null,
								finishedAt: now,
								updatedAt: now,
								error: row.cancelRequestedAt ? null : "Download lease expired",
							})
							.where(eq(runs.id, row.id));
						continue;
					}
					const [claimed] = await db
						.update(runs)
						.set({
							status: "in_progress",
							leaseToken: randomUUID(),
							leaseExpiresAt: nextLease,
							attemptCount: row.attemptCount + 1,
							startedAt: now,
							updatedAt: now,
							finishedAt: null,
						})
						.where(eq(runs.id, row.id))
						.returning();
					claims.push(downloadClaimSchema.parse(map(claimed)));
				}
				return claims;
			});
		},
		async heartbeat(claim) {
			return transactions.transaction(async (tx) => {
				await assertDedicated(tx);
				const rows = await getExecutor(tx)
					.update(runs)
					.set({ leaseExpiresAt: nextLease, updatedAt: now })
					.where(and(currentClaim(claim), isNull(runs.cancelRequestedAt)))
					.returning();
				return rows.length > 0;
			});
		},
		async withActiveClaim(claim, action) {
			return transactions.transaction(async (tx) => {
				await locked(claim, tx);
				const value = await action(tx);
				const renewed = await getExecutor(tx)
					.update(runs)
					.set({ leaseExpiresAt: nextLease, updatedAt: now })
					.where(and(currentClaim(claim), isNull(runs.cancelRequestedAt)))
					.returning();
				if (!renewed.length) throw new DownloadAttemptLostError();
				return value;
			});
		},
		async saveCheckpoint(claim, checkpoint, tx) {
			await assertDedicated(tx);
			const rows = await getExecutor(tx)
				.update(runs)
				.set({
					checkpoint: downloadRegistrationCheckpointSchema.parse(checkpoint),
					updatedAt: now,
				})
				.where(and(currentClaim(claim), isNull(runs.cancelRequestedAt)))
				.returning();
			if (!rows.length) throw new DownloadAttemptLostError();
		},
		async release(claim) {
			return transactions.transaction(async (tx) => {
				await assertDedicated(tx);
				const db = getExecutor(tx);
				const [active] = await db
					.select()
					.from(runs)
					.where(currentClaim(claim))
					.for("update");
				if (!active) return null;
				const cancelled = !!active.cancelRequestedAt;
				const [released] = await db
					.update(runs)
					.set({
						status: cancelled ? "cancelled" : "pending",
						...clearLease,
						attemptCount: cancelled
							? active.attemptCount
							: Math.max(0, active.attemptCount - 1),
						nextRunAt: now,
						startedAt: null,
						finishedAt: cancelled ? now : null,
						cancelledAt: cancelled ? now : null,
						updatedAt: now,
						error: null,
					})
					.where(currentClaim(claim))
					.returning();
				return released ? map(released) : null;
			});
		},
		async settle(claim, outcome, error) {
			return transactions.transaction(async (tx) => {
				await assertDedicated(tx);
				const db = getExecutor(tx);
				const [active] = await db
					.select()
					.from(runs)
					.where(currentClaim(claim))
					.for("update");
				if (!active) return null;
				const status = active.cancelRequestedAt ? "cancelled" : outcome;
				if (status === "cancelled" && !active.cancelRequestedAt) return null;
				const checkpoint = active.checkpoint
					? downloadRegistrationCheckpointSchema.parse(active.checkpoint)
					: null;
				if (
					status === "completed" &&
					(!checkpoint ||
						checkpoint.entries.some(
							(entry) => !entry.published || !entry.mediaId,
						))
				)
					throw new ResourceConflictError(
						"Download registration is not complete",
					);
				const [settled] = await db
					.update(runs)
					.set({
						status,
						...clearLease,
						finishedAt: now,
						updatedAt: now,
						cancelledAt: status === "cancelled" ? now : null,
						error: status === "failed" ? (error ?? "Download failed") : null,
						result:
							status === "completed"
								? {
										mediaIds:
											checkpoint?.entries.flatMap((entry) =>
												entry.mediaId ? [entry.mediaId] : [],
											) ?? [],
									}
								: null,
					})
					.where(currentClaim(claim))
					.returning();
				return settled ? map(settled) : null;
			});
		},
		async retry(id) {
			try {
				return await transactions.transaction(async (tx) => {
					await assertDedicated(tx);
					const db = getExecutor(tx);
					const [row] = await db
						.select()
						.from(runs)
						.where(eq(runs.id, id))
						.for("update");
					if (!row) throw new ResourceNotFoundError("Download", id);
					if (row.status !== "failed" || !row.input || !row.mediaSourceId)
						throw new ResourceConflictError(
							"Only failed downloads with valid input can be retried",
						);
					const [retried] = await db
						.update(runs)
						.set({
							status: "pending",
							error: null,
							result: null,
							nextRunAt: now,
							...clearLease,
							maxAttempts: row.attemptCount + 3,
							cancelRequestedAt: null,
							cancelledAt: null,
							startedAt: null,
							finishedAt: null,
							updatedAt: now,
						})
						.where(eq(runs.id, id))
						.returning();
					return map(retried);
				});
			} catch (error) {
				if (isUniqueConflict(error))
					throw new ResourceConflictError(
						"An equivalent download is already active",
					);
				throw error;
			}
		},
		async cancel(id) {
			return transactions.transaction(async (tx) => {
				await assertDedicated(tx);
				const db = getExecutor(tx);
				const [row] = await db
					.select()
					.from(runs)
					.where(eq(runs.id, id))
					.for("update");
				if (!row) throw new ResourceNotFoundError("Download", id);
				if (!["pending", "in_progress"].includes(row.status))
					throw new ResourceConflictError(
						"Only pending or running downloads can be cancelled",
					);
				const [cancelled] = await db
					.update(runs)
					.set({
						cancelRequestedAt: now,
						updatedAt: now,
						...(row.status === "pending"
							? {
									status: "cancelled",
									...clearLease,
									cancelledAt: now,
									finishedAt: now,
								}
							: {}),
					})
					.where(eq(runs.id, id))
					.returning();
				return map(cancelled);
			});
		},
	};
}
