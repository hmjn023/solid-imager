import { randomUUID } from "node:crypto";
import {
	and,
	asc,
	count,
	desc,
	eq,
	inArray,
	notInArray,
	isNull,
	or,
	sql,
} from "drizzle-orm";
import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import {
	BatchAttemptLostError,
	batchClaimSchema,
	batchInputSchema,
	batchItemSchema,
	batchProgressSchema,
	batchRunSchema,
	safeBatchAttemptSchema,
	retiredBatchJobTypes,
	type BatchClaim,
	type BatchItem,
	type BatchProgress,
	type BatchRun,
} from "@solid-imager/core/domain/batches/schemas";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	IBatchRunRepository,
	BatchSummary,
} from "@solid-imager/core/domain/repositories/batch-run-repository";
import {
	batchRuns as runs,
	batchItems as items,
	batchItemAttempts as attempts,
	batchRunCutovers as controls,
	batchRunDirty as dirty,
	batchRunLegacySnapshots as archives,
	medias,
	jobs,
} from "../schema";
import {
	migrateLegacyBatches,
	rollbackLegacyBatches,
} from "./batch-run-cutover";
import { createTransactionManager } from "../transaction-manager";
import type { DrizzleExecutor } from "../types";

export const BATCH_CONTROL_ID = "79000000-0000-4000-8000-000000000001";
const now = sql`timezone('UTC', clock_timestamp())`;
const nextLease = sql`${now} + interval '120 seconds'`;
const clearLease = { leaseToken: null, leaseExpiresAt: null };
const activeItemStatuses = ["pending", "scheduled"] as const;
function mapRun(row: typeof runs.$inferSelect): BatchRun {
	return batchRunSchema.parse({
		id: row.id,
		input: row.input,
		status: row.status,
		blockedReason: row.blockedReason,
		dispatchComplete: row.dispatchComplete,
		attemptCount: row.attemptCount,
		maxAttempts: row.maxAttempts,
		leaseToken: row.leaseToken,
		leaseExpiresAt: row.leaseExpiresAt,
		cancelRequestedAt: row.cancelRequestedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		finishedAt: row.finishedAt,
	});
}
function mapItem(row: typeof items.$inferSelect): BatchItem {
	return batchItemSchema.parse({
		id: row.id,
		runId: row.runId,
		mediaId: row.mediaId,
		mediaSourceId: row.mediaSourceId,
		kind: row.kind,
		input: row.input,
		plannedRevision: row.plannedRevision,
		requestId: row.requestId,
		requestedRevision: row.requestedRevision,
		status: row.status,
		attemptCount: row.attemptCount,
		failureCode: row.failureCode,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		finishedAt: row.finishedAt,
	});
}
function currentClaim(claim: BatchClaim) {
	return and(
		eq(runs.id, claim.id),
		eq(runs.status, "in_progress"),
		eq(runs.attemptCount, claim.attemptCount),
		eq(runs.leaseToken, claim.leaseToken),
		isNull(runs.cancelRequestedAt),
		sql`${runs.leaseExpiresAt} > ${now}`,
	);
}
function finalStatus(
	run: BatchRun,
	progress: BatchProgress,
): BatchRun["status"] {
	if (["blocked", "cancelled", "failed"].includes(run.status))
		return run.status;
	if (!run.dispatchComplete || progress.pending > 0) return run.status;
	return progress.failed ? "failed" : "completed";
}

export function createBatchRunRepository(
	getExecutor: (tx?: Transaction) => DrizzleExecutor,
): IBatchRunRepository {
	const transactions = createTransactionManager(() => getExecutor());
	async function assertDedicated(tx: Transaction) {
		const [control] = await getExecutor(tx)
			.select()
			.from(controls)
			.where(eq(controls.id, BATCH_CONTROL_ID))
			.for("share");
		if (control?.authority !== "dedicated")
			throw new ResourceConflictError("Dedicated batch writes are disabled");
	}
	async function progress(
		id: string,
		tx?: Transaction,
	): Promise<BatchProgress> {
		const [row] = await getExecutor(tx)
			.select({
				total: sql<number>`count(*)::int`,
				completed: sql<number>`count(*) FILTER (WHERE ${items.status} = 'completed')::int`,
				failed: sql<number>`count(*) FILTER (WHERE ${items.status} IN ('failed','superseded','blocked'))::int`,
				cancelled: sql<number>`count(*) FILTER (WHERE ${items.status} = 'cancelled')::int`,
				pending: sql<number>`count(*) FILTER (WHERE ${items.status} IN ('pending','scheduled'))::int`,
			})
			.from(items)
			.where(eq(items.runId, id));
		return batchProgressSchema.parse(row);
	}
	async function summary(
		row: typeof runs.$inferSelect,
		tx?: Transaction,
	): Promise<BatchSummary> {
		const run = mapRun(row);
		const current = await progress(run.id, tx);
		return {
			run: { ...run, status: finalStatus(run, current) },
			progress: current,
		};
	}
	async function locked(claim: BatchClaim, tx: Transaction) {
		await assertDedicated(tx);
		const [run] = await getExecutor(tx)
			.select()
			.from(runs)
			.where(currentClaim(claim))
			// Progress triggers insert children referencing this run. Keep FK KEY SHARE compatible.
			.for("no key update");
		if (!run) throw new BatchAttemptLostError();
		return run;
	}
	async function required(id: string, tx: Transaction) {
		const [run] = await getExecutor(tx)
			.select()
			.from(runs)
			.where(eq(runs.id, id))
			.for("no key update");
		if (!run) throw new ResourceNotFoundError("Batch", id);
		return run;
	}
	const repository: IBatchRunRepository = {
		assertDedicated,
		async initialize() {
			const [existing] = await getExecutor()
				.select()
				.from(controls)
				.where(eq(controls.id, BATCH_CONTROL_ID));
			if (existing?.authority === "dedicated")
				return { migrated: 0, blocked: 0 };
			return transactions.transaction(async (tx) => {
				const db = getExecutor(tx);
				// Match the table-then-authority lock order used by legacy writer triggers.
				await db.execute(sql`LOCK TABLE jobs IN SHARE ROW EXCLUSIVE MODE`);
				const [control] = await db
					.select()
					.from(controls)
					.where(eq(controls.id, BATCH_CONTROL_ID))
					.for("update");
				if (control?.authority === "dedicated")
					return { migrated: 0, blocked: 0 };
				if (!control || control.generation !== 0)
					throw new ResourceConflictError(
						"Batch migration requires an initial legacy epoch",
					);
				// Verify bounded backfill before authority changes.
				const retiredParents = db
					.select({ id: jobs.id })
					.from(jobs)
					.where(inArray(jobs.type, [...retiredBatchJobTypes]));
				const [foreignChild] = await db
					.select({ id: jobs.id })
					.from(jobs)
					.where(
						and(
							inArray(jobs.parentId, retiredParents),
							notInArray(jobs.type, [...retiredBatchJobTypes]),
						),
					)
					.limit(1);
				if (foreignChild)
					throw new ResourceConflictError(
						"Classify foreign legacy children before batch cutover",
					);
				const report = await migrateLegacyBatches(db);
				await db
					.delete(jobs)
					.where(inArray(jobs.type, [...retiredBatchJobTypes]));
				await db
					.update(controls)
					.set({ authority: "dedicated", generation: 1, updatedAt: now })
					.where(eq(controls.id, BATCH_CONTROL_ID));
				return report;
			});
		},
		async beginCapture(input, tx) {
			const db = getExecutor(tx);
			// Must be the first statement: all paged target queries see the same media set.
			await db.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`);
			await assertDedicated(tx);
			const [row] = await db
				.insert(runs)
				.values({
					input: batchInputSchema.parse(input),
					createdAt: now,
					updatedAt: now,
				})
				.returning();
			return mapRun(row);
		},
		async appendTargets(id, targets, tx) {
			if (!targets.length) return;
			await getExecutor(tx)
				.insert(items)
				.values(
					targets.map((target) => ({
						...target,
						runId: id,
						createdAt: now,
						updatedAt: now,
					})),
				);
		},
		async sealCapture(id, tx) {
			const row = await required(id, tx);
			const current = await progress(id, tx);
			if (!current.total) {
				const [finished] = await getExecutor(tx)
					.update(runs)
					.set({
						status: "completed",
						dispatchComplete: true,
						finishedAt: now,
						updatedAt: now,
					})
					.where(eq(runs.id, id))
					.returning();
				return summary(finished, tx);
			}
			return { run: mapRun(row), progress: current };
		},
		async findById(id, tx) {
			const [row] = await getExecutor(tx)
				.select()
				.from(runs)
				.where(eq(runs.id, id));
			return row ? summary(row, tx) : null;
		},
		async resolveId(id, tx) {
			const db = getExecutor(tx);
			const [run] = await db
				.select({ id: runs.id })
				.from(runs)
				.where(eq(runs.id, id));
			if (run) return id;
			const [item] = await db
				.select({ id: items.runId })
				.from(items)
				.where(eq(items.id, id));
			if (item) return item.id;
			const [archive] = await db
				.select({ id: archives.runId })
				.from(archives)
				.where(eq(archives.id, id));
			return archive?.id ?? null;
		},
		async findItem(id, tx) {
			const [row] = await getExecutor(tx)
				.select()
				.from(items)
				.where(eq(items.id, id));
			return row ? mapItem(row) : null;
		},
		async listAttempts(id, limit, offset) {
			const item = await repository.findItem(id);
			if (!item) throw new ResourceNotFoundError("Batch item", id);
			const rows = await getExecutor()
				.select()
				.from(attempts)
				.where(eq(attempts.itemId, id))
				.orderBy(desc(attempts.attemptCount))
				.limit(limit)
				.offset(offset);
			const [total] = await getExecutor()
				.select({ value: count() })
				.from(attempts)
				.where(eq(attempts.itemId, id));
			return {
				items: rows.map((row) =>
					safeBatchAttemptSchema.parse({
						id: row.id,
						itemId: row.itemId,
						attemptCount: row.attemptCount,
						status: row.status,
						createdAt: row.createdAt,
						finishedAt: row.finishedAt,
						failureCode:
							row.failureCode === "processing_failed" ||
							row.failureCode === "input_changed"
								? row.failureCode
								: row.failureCode
									? "legacy_blocked"
									: null,
					}),
				),
				total: total?.value ?? 0,
			};
		},
		async findItemsByIds(ids, tx) {
			return ids.length
				? (
						await getExecutor(tx)
							.select()
							.from(items)
							.where(inArray(items.id, ids))
					).map(mapItem)
				: [];
		},
		async retryItem(id) {
			return transactions.transaction(async (tx) => {
				await assertDedicated(tx);
				const initial = await repository.findItem(id, tx);
				if (!initial) throw new ResourceNotFoundError("Batch item", id);
				const run = await required(initial.runId, tx);
				if (
					!run.input ||
					run.status === "blocked" ||
					run.status === "cancelled"
				)
					throw new ResourceConflictError(
						"Resume the batch before retrying this item",
					);
				const changed = await getExecutor(tx)
					.update(items)
					.set({
						status: "pending",
						failureCode: null,
						finishedAt: null,
						updatedAt: now,
					})
					.where(
						and(
							eq(items.id, id),
							inArray(items.status, ["failed", "superseded"]),
						),
					)
					.returning();
				if (!changed.length)
					throw new ResourceConflictError("Only failed items can be retried");
				const [updated] = await getExecutor(tx)
					.update(runs)
					.set({
						status: "pending",
						dispatchComplete: false,
						...clearLease,
						maxAttempts: run.attemptCount + 3,
						finishedAt: null,
						updatedAt: now,
					})
					.where(eq(runs.id, run.id))
					.returning();
				return summary(updated, tx);
			});
		},
		async findByIds(ids, tx) {
			if (!ids.length) return [];
			const rows = await getExecutor(tx)
				.select()
				.from(runs)
				.where(inArray(runs.id, ids));
			const results: BatchSummary[] = [];
			for (const row of rows) results.push(await summary(row, tx));
			return results;
		},
		async list(input, tx) {
			const filter = input.status
				? sql`EXISTS (SELECT 1 FROM batch_run_status b WHERE b.id = ${runs.id} AND b.status = ${input.status})`
				: undefined;
			const db = getExecutor(tx);
			const rows = await db
				.select()
				.from(runs)
				.where(filter)
				.orderBy(desc(runs.createdAt), desc(runs.id))
				.limit(input.limit)
				.offset(input.offset);
			const [total] = await db
				.select({ value: count() })
				.from(runs)
				.where(filter);
			const results: BatchSummary[] = [];
			for (const row of rows) results.push(await summary(row, tx));
			return { items: results, total: total?.value ?? 0 };
		},
		async listItems(id, limit, offset) {
			return transactions.transaction(async (tx) => {
				await assertDedicated(tx);
				await required(id, tx);
				const db = getExecutor(tx);
				const rows = await db
					.select()
					.from(items)
					.where(eq(items.runId, id))
					.orderBy(asc(items.id))
					.limit(limit)
					.offset(offset);
				const [total] = await db
					.select({ value: count() })
					.from(items)
					.where(eq(items.runId, id));
				return { items: rows.map(mapItem), total: total?.value ?? 0 };
			});
		},
		async claimPending(limit) {
			if (limit < 1) return [];
			return transactions.transaction(async (tx) => {
				await assertDedicated(tx);
				const db = getExecutor(tx);
				const rows = await db
					.select()
					.from(runs)
					.where(
						and(
							eq(runs.dispatchComplete, false),
							isNull(runs.cancelRequestedAt),
							or(
								eq(runs.status, "pending"),
								and(
									eq(runs.status, "in_progress"),
									sql`${runs.leaseExpiresAt} <= ${now}`,
								),
							),
						),
					)
					.orderBy(asc(runs.createdAt), asc(runs.id))
					.limit(limit)
					.for("no key update", { skipLocked: true });
				const claimed: BatchClaim[] = [];
				for (const run of rows) {
					if (run.attemptCount >= run.maxAttempts) {
						await db
							.update(runs)
							.set({
								status: "failed",
								...clearLease,
								updatedAt: now,
								finishedAt: now,
							})
							.where(eq(runs.id, run.id));
						continue;
					}
					const [row] = await db
						.update(runs)
						.set({
							status: "in_progress",
							attemptCount: run.attemptCount + 1,
							leaseToken: randomUUID(),
							leaseExpiresAt: nextLease,
							updatedAt: now,
						})
						.where(eq(runs.id, run.id))
						.returning();
					claimed.push(batchClaimSchema.parse(mapRun(row)));
				}
				return claimed;
			});
		},
		async withActiveClaim(claim, action) {
			return transactions.transaction(async (tx) => {
				await locked(claim, tx);
				const result = await action(tx);
				const renewed = await getExecutor(tx)
					.update(runs)
					.set({ leaseExpiresAt: nextLease, updatedAt: now })
					.where(currentClaim(claim))
					.returning();
				if (!renewed.length) throw new BatchAttemptLostError();
				return result;
			});
		},
		async pendingItems(claim, limit, tx) {
			await locked(claim, tx);
			const page = (
				await getExecutor(tx)
					.select()
					.from(items)
					.where(and(eq(items.runId, claim.id), eq(items.status, "pending")))
					.orderBy(asc(items.mediaId), asc(items.kind))
					.limit(limit)
			).map(mapItem);
			// Reserve locks every media in the page before any item update acquires the
			// shared dirty marker. Otherwise a later media can be held by a worker
			// waiting for that marker: dispatch -> marker -> media -> worker -> marker.
			if (page.length)
				await getExecutor(tx)
					.select({ id: medias.id })
					.from(medias)
					.where(
						inArray(
							medias.id,
							page.map((item) => item.mediaId),
						),
					)
					.orderBy(asc(medias.id))
					.for("update");
			return page;
		},
		async bindItem(claim, item, state, tx) {
			await locked(claim, tx);
			if (
				item.runId !== claim.id ||
				item.mediaId !== state.mediaId ||
				item.kind !== state.taskKind
			)
				throw new BatchAttemptLostError();
			const status: BatchItem["status"] =
				state.status === "completed" || state.status === "failed"
					? state.status
					: "scheduled";
			const values = {
				requestId: state.requestId,
				requestedRevision: state.requestedRevision,
				status,
				attemptCount: item.attemptCount + 1,
				failureCode: status === "failed" ? "processing_failed" : null,
				updatedAt: now,
				finishedAt: status === "scheduled" ? null : now,
			};
			const changed = await getExecutor(tx)
				.update(items)
				.set(values)
				.where(
					and(
						eq(items.id, item.id),
						eq(items.runId, claim.id),
						eq(items.status, "pending"),
					),
				)
				.returning();
			if (!changed.length) throw new BatchAttemptLostError();
			await getExecutor(tx).insert(attempts).values({
				itemId: item.id,
				attemptCount: values.attemptCount,
				requestId: state.requestId,
				requestedRevision: state.requestedRevision,
				status,
				failureCode: values.failureCode,
				createdAt: now,
				finishedAt: values.finishedAt,
			});
		},
		async failItem(claim, item, code, tx) {
			await locked(claim, tx);
			await getExecutor(tx)
				.update(items)
				.set({
					status: "failed",
					failureCode: code,
					updatedAt: now,
					finishedAt: now,
				})
				.where(
					and(
						eq(items.id, item.id),
						eq(items.runId, claim.id),
						eq(items.status, "pending"),
					),
				);
		},
		async finishDispatch(claim, tx) {
			await locked(claim, tx);
			await getExecutor(tx)
				.update(runs)
				.set({ dispatchComplete: true, updatedAt: now })
				.where(currentClaim(claim));
			await getExecutor(tx)
				.insert(dirty)
				.values({ runId: claim.id })
				.onConflictDoUpdate({
					target: dirty.runId,
					set: { generation: sql`${dirty.generation} + 1` },
				});
		},
		async reconcile(limit) {
			return transactions.transaction(async (tx) => {
				await assertDedicated(tx);
				const db = getExecutor(tx);
				const rows = await db
					.select({ run: runs })
					.from(runs)
					.innerJoin(dirty, eq(dirty.runId, runs.id))
					.orderBy(asc(runs.id))
					.limit(limit)
					.for("no key update", { of: runs, skipLocked: true });
				const changed: BatchSummary[] = [];
				for (const { run: row } of rows) {
					const [marker] = await db
						.select()
						.from(dirty)
						.where(eq(dirty.runId, row.id))
						.for("update");
					if (!marker) continue;
					const current = await summary(row, tx);
					const [updated] = await db
						.update(runs)
						.set({
							status: current.run.status,
							...(row.dispatchComplete ? clearLease : {}),
							updatedAt: now,
							finishedAt: ["pending", "in_progress"].includes(
								current.run.status,
							)
								? null
								: now,
						})
						.where(eq(runs.id, row.id))
						.returning();
					await db
						.delete(dirty)
						.where(
							and(
								eq(dirty.runId, row.id),
								eq(dirty.generation, marker.generation),
							),
						);
					changed.push({ run: mapRun(updated), progress: current.progress });
				}
				return changed;
			});
		},
		async cancel(id) {
			return transactions.transaction(async (tx) => {
				await assertDedicated(tx);
				const row = await required(id, tx);
				const current = await summary(row, tx);
				if (
					["completed", "failed", "cancelled", "blocked"].includes(
						current.run.status,
					)
				)
					return current;
				const db = getExecutor(tx);
				await db
					.update(items)
					.set({ status: "cancelled", updatedAt: now, finishedAt: now })
					.where(
						and(
							eq(items.runId, id),
							inArray(items.status, [...activeItemStatuses]),
						),
					);
				await db
					.update(attempts)
					.set({ status: "cancelled", finishedAt: now })
					.where(
						and(
							eq(attempts.status, "scheduled"),
							sql`${attempts.itemId} IN (SELECT id FROM batch_items WHERE run_id = ${id})`,
						),
					);
				const [cancelled] = await db
					.update(runs)
					.set({
						status: "cancelled",
						cancelRequestedAt: now,
						...clearLease,
						updatedAt: now,
						finishedAt: now,
					})
					.where(eq(runs.id, id))
					.returning();
				return summary(cancelled, tx);
			});
		},
		async retry(id, scope) {
			return transactions.transaction(async (tx) => {
				await assertDedicated(tx);
				const row = await required(id, tx);
				const current = await summary(row, tx);
				const allowed =
					scope === "failed"
						? ["pending", "in_progress", "failed"]
						: ["failed", "cancelled"];
				if (!row.input || !allowed.includes(current.run.status))
					throw new ResourceConflictError(
						"Only failed or cancelled batches can be resumed",
					);
				const db = getExecutor(tx);
				const retryStatuses: BatchItem["status"][] =
					scope === "failed"
						? ["failed", "superseded"]
						: ["failed", "cancelled", "superseded"];
				if (scope === "failed" && current.run.status !== "failed") {
					const [failed] = await db
						.select({ id: items.id })
						.from(items)
						.where(
							and(eq(items.runId, id), inArray(items.status, retryStatuses)),
						)
						.limit(1);
					if (!failed)
						throw new ResourceConflictError("No failed batch items remain");
				}
				await db
					.update(items)
					.set({
						status: "pending",
						failureCode: null,
						finishedAt: null,
						updatedAt: now,
					})
					.where(
						and(eq(items.runId, id), inArray(items.status, retryStatuses)),
					);
				const [retried] = await db
					.update(runs)
					.set({
						status: "pending",
						dispatchComplete: false,
						cancelRequestedAt: null,
						...clearLease,
						maxAttempts: row.attemptCount + 3,
						updatedAt: now,
						finishedAt: null,
					})
					.where(eq(runs.id, id))
					.returning();
				return summary(retried, tx);
			});
		},
		async rollback() {
			return rollbackLegacyBatches(getExecutor, repository);
		},
	};
	return repository;
}
