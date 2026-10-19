import { randomUUID } from "node:crypto";
import {
	and,
	asc,
	eq,
	gt,
	inArray,
	isNull,
	lte,
	notExists,
	or,
	sql,
} from "drizzle-orm";
import { z } from "zod";
import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import {
	SourceRunAttemptLostError,
	sourceRunClaimSchema,
	sourceRunSchema,
	sourceRunInputSchema,
	sourceSyncWatermarkSchema,
	type SourceRun,
	type SourceRunClaim,
	type SourceRunKind,
} from "@solid-imager/core/domain/source-runs/schemas";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { ISourceRunRepository } from "@solid-imager/core/domain/repositories/source-run-repository";
import { isRecord } from "@solid-imager/core/utils/type-guards";
import {
	sourceSyncRuns as syncs,
	sourceTransferRuns as transfers,
	sourceRunLeases as owners,
	sourceSyncWatermarks as watermarks,
	sourceRunCutovers as controls,
	mediaSources,
} from "../schema";
import { createTransactionManager } from "../transaction-manager";
import type { DrizzleExecutor } from "../types";
import { activateSourceRuns, rollbackSourceRuns } from "./source-run-cutover";

const CONTROL_ID = "79100000-0000-4000-8000-000000000001";
const now = sql`timezone('UTC',clock_timestamp())`;
const expires = sql`${now} + interval '120 seconds'`;
const retained = sql`${now} + interval '24 hours'`;
const emptyOwner = { runId: null, kind: null, token: null, expiresAt: null };
const emptyLease = { leaseToken: null, leaseExpiresAt: null };
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
function map(row: typeof syncs.$inferSelect): SourceRun {
	return sourceRunSchema.parse({
		id: row.id,
		sourceId: row.sourceId,
		kind: row.kind,
		input: row.input,
		status: row.status,
		checkpoint: row.checkpoint,
		artifact: row.artifact,
		failureCode: row.failureCode,
		attemptCount: row.attemptCount,
		maxAttempts: row.maxAttempts,
		leaseToken: row.leaseToken,
		leaseExpiresAt: row.leaseExpiresAt,
		retentionExpiresAt: row.retentionExpiresAt,
		cancelRequestedAt: row.cancelRequestedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		startedAt: row.startedAt,
		finishedAt: row.finishedAt,
	});
}
export function createSourceRunRepository(
	getExecutor: (tx?: Transaction) => DrizzleExecutor,
): ISourceRunRepository {
	const transactions = createTransactionManager(() => getExecutor());
	async function assertDedicated(tx: Transaction) {
		const [control] = await getExecutor(tx)
			.select()
			.from(controls)
			.where(eq(controls.id, CONTROL_ID))
			.for("share");
		if (control?.authority !== "dedicated")
			throw new ResourceConflictError(
				"Dedicated source operations are disabled",
			);
	}
	async function lockOwner(
		sourceId: string,
		tx: Transaction,
		skipLocked = false,
	) {
		const db = getExecutor(tx);
		await db.insert(owners).values({ sourceId }).onConflictDoNothing();
		const [owner] = await db
			.select()
			.from(owners)
			.where(eq(owners.sourceId, sourceId))
			.for("update", skipLocked ? { skipLocked: true } : undefined);
		return owner;
	}
	async function active(claim: SourceRunClaim, tx: Transaction) {
		await assertDedicated(tx);
		const owner = await lockOwner(claim.sourceId, tx);
		if (!owner || owner.runId !== claim.id || owner.token !== claim.leaseToken)
			throw new SourceRunAttemptLostError();
		const table = tableFor(claim.kind);
		const [row] = await getExecutor(tx)
			.select()
			.from(table)
			.where(
				and(
					eq(table.id, claim.id),
					eq(table.leaseToken, claim.leaseToken),
					eq(table.status, "in_progress"),
					eq(table.attemptCount, claim.attemptCount),
					gt(table.leaseExpiresAt, now),
					isNull(table.cancelRequestedAt),
				),
			)
			.for("update");
		if (!row) throw new SourceRunAttemptLostError();
		return map(row);
	}
	async function mutate<T>(
		claim: SourceRunClaim,
		action: (tx: Transaction, current: SourceRun) => Promise<T>,
		finish = false,
	): Promise<T> {
		return transactions.transaction(async (tx) => {
			const current = await active(claim, tx);
			const result = await action(tx, current);
			const changed = await getExecutor(tx)
				.update(owners)
				.set(finish ? emptyOwner : { expiresAt: expires })
				.where(
					and(
						eq(owners.sourceId, claim.sourceId),
						eq(owners.runId, claim.id),
						eq(owners.token, claim.leaseToken),
						gt(owners.expiresAt, now),
					),
				)
				.returning();
			if (!changed.length) throw new SourceRunAttemptLostError();
			if (!finish) {
				const table = tableFor(claim.kind);
				await getExecutor(tx)
					.update(table)
					.set({
						leaseExpiresAt: expires,
						updatedAt: now,
						...(claim.kind === "restore"
							? { retentionExpiresAt: retained }
							: {}),
					})
					.where(
						and(eq(table.id, claim.id), eq(table.leaseToken, claim.leaseToken)),
					);
			}
			return result;
		});
	}
	async function queueSync(
		sourceId: string,
		sourcePath: string,
		generation: number,
		tx: Transaction,
	) {
		const [run] = await getExecutor(tx)
			.insert(syncs)
			.values({
				sourceId,
				kind: "sync",
				input: asJsonb({ kind: "sync", sourcePath, generation }),
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: syncs.sourceId,
				targetWhere: eq(syncs.status, "pending"),
				set: {
					input: sql`CASE WHEN (${syncs.input}->>'generation')::bigint < ${generation} THEN excluded.input ELSE ${syncs.input} END`,
					updatedAt: now,
				},
			})
			.returning();
		return map(run);
	}
	const repo: ISourceRunRepository = {
		initialize: () => activateSourceRuns(getExecutor),
		assertDedicated,
		async requestSync(sourceId, sourcePath) {
			const generation = await transactions.transaction(async (tx) => {
				await assertDedicated(tx);
				const [row] = await getExecutor(tx)
					.insert(watermarks)
					.values({ sourceId, generation: 1, requestedGeneration: 1 })
					.onConflictDoUpdate({
						target: watermarks.sourceId,
						set: {
							generation: sql`${watermarks.generation}+1`,
							requestedGeneration: sql`${watermarks.generation}+1`,
						},
					})
					.returning();
				return row.generation;
			});
			const run = await transactions.transaction(async (tx) => {
				await assertDedicated(tx);
				return queueSync(sourceId, sourcePath, generation, tx);
			});
			return { run, generation };
		},
		async watermark(sourceId) {
			const [row] = await getExecutor()
				.select()
				.from(watermarks)
				.where(eq(watermarks.sourceId, sourceId));
			return row ? sourceSyncWatermarkSchema.parse(row) : null;
		},
		async createTransfer(sourceId, input, id) {
			return transactions.transaction(async (tx) => {
				await assertDedicated(tx);
				const parsed = sourceRunInputSchema.parse(input);
				if (parsed.kind === "sync")
					throw new ResourceConflictError(
						"Use requestSync for directory operations",
					);
				const [row] = await getExecutor(tx)
					.insert(transfers)
					.values({
						id,
						sourceId,
						kind: parsed.kind,
						input: asJsonb(parsed),
						retentionExpiresAt: parsed.kind === "restore" ? retained : null,
						createdAt: now,
						updatedAt: now,
					})
					.returning();
				return map(row);
			});
		},
		async findById(id, tx) {
			const db = getExecutor(tx);
			const [sync] = await db.select().from(syncs).where(eq(syncs.id, id));
			if (sync) return map(sync);
			const [transfer] = await db
				.select()
				.from(transfers)
				.where(eq(transfers.id, id));
			return transfer ? map(transfer) : null;
		},
		async findByIds(ids, tx) {
			if (!ids.length) return [];
			const db = getExecutor(tx);
			return [
				...(await db.select().from(syncs).where(inArray(syncs.id, ids))),
				...(await db
					.select()
					.from(transfers)
					.where(inArray(transfers.id, ids))),
			].map(map);
		},
		async list(input, tx) {
			const result = await getExecutor(tx).execute(sql`
    WITH combined AS (SELECT id,source_id,kind,status,created_at FROM source_sync_runs UNION ALL SELECT id,source_id,kind,status,created_at FROM source_transfer_runs),
    filtered AS (SELECT * FROM combined WHERE true ${input.sourceId ? sql`AND source_id=${input.sourceId}::uuid` : sql``} ${input.kind ? sql`AND kind=${input.kind}` : sql``} ${input.status ? sql`AND status=${input.status}` : sql``}),
    page AS (SELECT * FROM filtered ORDER BY created_at DESC,id DESC LIMIT ${input.limit} OFFSET ${input.offset})
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',id) ORDER BY created_at DESC,id DESC),'[]'::jsonb) AS ids,(SELECT count(*) FROM filtered) AS total FROM page
   `);
			const page = z
				.object({
					ids: z.array(z.object({ id: z.uuid() })),
					total: z.coerce.number().int(),
				})
				.parse(rowsOf(result)[0]);
			const runs = await repo.findByIds(
				page.ids.map((row) => row.id),
				tx,
			);
			const byId = new Map(runs.map((run) => [run.id, run]));
			return {
				items: page.ids.flatMap((row) => {
					const run = byId.get(row.id);
					return run ? [run] : [];
				}),
				total: page.total,
			};
		},
		async ensureSyncRuns() {
			await transactions.transaction(async (tx) => {
				await assertDedicated(tx);
				const db = getExecutor(tx);
				const rows = await db
					.select({ mark: watermarks, source: mediaSources })
					.from(watermarks)
					.innerJoin(mediaSources, eq(mediaSources.id, watermarks.sourceId))
					.where(
						and(
							eq(mediaSources.type, "local"),
							gt(watermarks.requestedGeneration, watermarks.appliedGeneration),
							sql`jsonb_typeof(${mediaSources.connectionInfo}->'path')='string'`,
							notExists(
								db
									.select({ id: syncs.id })
									.from(syncs)
									.where(
										and(
											eq(syncs.sourceId, watermarks.sourceId),
											sql`coalesce((${syncs.input}->>'generation')::bigint,0) >= ${watermarks.requestedGeneration}`,
										),
									),
							),
						),
					)
					.orderBy(asc(watermarks.sourceId))
					.limit(100);
				for (const { mark, source } of rows) {
					const connection = localConnectionSchema.safeParse(
						source.connectionInfo,
					);
					if (connection.success)
						await queueSync(
							source.id,
							connection.data.path,
							mark.requestedGeneration,
							tx,
						);
				}
			});
		},
		async claimPending(kinds, limit, sourceId) {
			if (limit < 1 || !kinds.length) return [];
			const db = getExecutor();
			const candidates: SourceRun[] = [];
			for (const table of [syncs, transfers]) {
				const rows = await db
					.select()
					.from(table)
					.where(
						and(
							inArray(table.kind, kinds),
							sourceId ? eq(table.sourceId, sourceId) : undefined,
							or(
								eq(table.status, "pending"),
								and(
									eq(table.status, "in_progress"),
									lte(table.leaseExpiresAt, now),
								),
							),
							notExists(
								db
									.select({ id: owners.sourceId })
									.from(owners)
									.where(
										and(
											eq(owners.sourceId, table.sourceId),
											gt(owners.expiresAt, now),
										),
									),
							),
						),
					)
					.orderBy(asc(table.createdAt), asc(table.id))
					.limit(Math.min(100, limit * 4));
				candidates.push(...rows.map(map));
			}
			candidates.sort(
				(a, b) =>
					a.createdAt.getTime() - b.createdAt.getTime() ||
					a.id.localeCompare(b.id),
			);
			const claims: SourceRunClaim[] = [];
			for (const candidate of candidates) {
				if (claims.length >= limit) break;
				const ownerSourceId = candidate.sourceId;
				if (!ownerSourceId || !candidate.input) continue;
				const claim = await transactions.transaction(async (tx) => {
					await assertDedicated(tx);
					const owned = await lockOwner(ownerSourceId, tx, true);
					if (!owned) return null;
					const [lease] = await getExecutor(tx)
						.select()
						.from(owners)
						.where(
							and(
								eq(owners.sourceId, ownerSourceId),
								or(isNull(owners.token), lte(owners.expiresAt, now)),
							),
						);
					if (!lease) return null;
					const table = tableFor(candidate.kind);
					const [row] = await getExecutor(tx)
						.select()
						.from(table)
						.where(
							and(
								eq(table.id, candidate.id),
								or(
									eq(table.status, "pending"),
									and(
										eq(table.status, "in_progress"),
										lte(table.leaseExpiresAt, now),
									),
								),
							),
						)
						.for("update", { skipLocked: true });
					if (!row) return null;
					const [expiredInput] =
						row.kind === "restore"
							? await getExecutor(tx)
									.select({ id: table.id })
									.from(table)
									.where(
										and(
											eq(table.id, row.id),
											lte(table.retentionExpiresAt, now),
										),
									)
							: [];
					if (expiredInput) {
						await getExecutor(tx)
							.update(table)
							.set({
								status: "blocked",
								failureCode: "input_expired",
								...emptyLease,
								updatedAt: now,
								finishedAt: now,
							})
							.where(eq(table.id, row.id));
						if (lease.runId === row.id)
							await getExecutor(tx)
								.update(owners)
								.set(emptyOwner)
								.where(eq(owners.sourceId, ownerSourceId));
						return null;
					}
					if (lease.runId && lease.runId !== row.id && lease.kind) {
						const previous = tableFor(lease.kind);
						await getExecutor(tx)
							.update(previous)
							.set({
								status: lease.kind === "sync" ? "failed" : "pending",
								failureCode:
									lease.kind === "sync" ? "interrupted_by_newer_sync" : null,
								...emptyLease,
								updatedAt: now,
							})
							.where(
								and(
									eq(previous.id, lease.runId),
									eq(previous.status, "in_progress"),
									lease.token
										? eq(previous.leaseToken, lease.token)
										: undefined,
								),
							);
					}
					if (row.attemptCount >= row.maxAttempts) {
						await getExecutor(tx)
							.update(table)
							.set({
								status: "failed",
								failureCode: "lease_exhausted",
								...emptyLease,
								updatedAt: now,
								finishedAt: now,
							})
							.where(eq(table.id, row.id));
						await getExecutor(tx)
							.update(owners)
							.set(emptyOwner)
							.where(eq(owners.sourceId, ownerSourceId));
						return null;
					}
					const token = randomUUID();
					await getExecutor(tx)
						.update(owners)
						.set({ runId: row.id, kind: row.kind, token, expiresAt: expires })
						.where(eq(owners.sourceId, ownerSourceId));
					const [updated] = await getExecutor(tx)
						.update(table)
						.set({
							status: "in_progress",
							attemptCount: row.attemptCount + 1,
							leaseToken: token,
							leaseExpiresAt: expires,
							startedAt: row.startedAt ?? now,
							updatedAt: now,
							finishedAt: null,
						})
						.where(eq(table.id, row.id))
						.returning();
					return sourceRunClaimSchema.parse(map(updated));
				});
				if (claim) claims.push(claim);
			}
			return claims;
		},
		withActiveClaim: (claim, action) => mutate(claim, action),
		async heartbeat(claim) {
			try {
				await mutate(claim, async () => {});
				return true;
			} catch (error) {
				if (error instanceof SourceRunAttemptLostError) return false;
				throw error;
			}
		},
		async checkpoint(claim, checkpoint, tx) {
			const table = tableFor(claim.kind);
			const changed = await getExecutor(tx)
				.update(table)
				.set({ checkpoint: asJsonb(checkpoint), updatedAt: now })
				.where(
					and(
						eq(table.id, claim.id),
						eq(table.leaseToken, claim.leaseToken),
						eq(table.status, "in_progress"),
					),
				)
				.returning();
			if (!changed.length) throw new SourceRunAttemptLostError();
		},
		async complete(claim, artifact, publish) {
			try {
				return await mutate(
					claim,
					async (tx, current) => {
						await publish?.(tx);
						const db = getExecutor(tx);
						const table = tableFor(claim.kind);
						if (current.input?.kind === "sync")
							await db
								.update(watermarks)
								.set({
									appliedGeneration: sql`greatest(${watermarks.appliedGeneration},${current.input.generation})`,
								})
								.where(
									and(
										eq(watermarks.sourceId, claim.sourceId),
										sql`${watermarks.generation} >= ${current.input.generation}`,
									),
								);
						const [row] = await db
							.update(table)
							.set({
								status: "completed",
								artifact: asJsonb(artifact ?? null),
								...emptyLease,
								failureCode: null,
								retentionExpiresAt: claim.kind === "sync" ? null : retained,
								updatedAt: now,
								finishedAt: now,
							})
							.where(eq(table.id, claim.id))
							.returning();
						return map(row);
					},
					true,
				);
			} catch (error) {
				if (error instanceof SourceRunAttemptLostError) return null;
				throw error;
			}
		},
		async fail(claim, code, blocked = false) {
			try {
				return await mutate(
					claim,
					async (tx) => {
						const table = tableFor(claim.kind);
						const [row] = await getExecutor(tx)
							.update(table)
							.set({
								status: blocked ? "blocked" : "failed",
								failureCode: code,
								...emptyLease,
								updatedAt: now,
								finishedAt: now,
							})
							.where(eq(table.id, claim.id))
							.returning();
						return map(row);
					},
					true,
				);
			} catch (error) {
				if (error instanceof SourceRunAttemptLostError) return null;
				throw error;
			}
		},
		async cancel(id) {
			return transactions.transaction(async (tx) => {
				await assertDedicated(tx);
				const initial = await repo.findById(id, tx);
				if (!initial) throw new ResourceNotFoundError("Source run", id);
				const owner = initial.sourceId
					? await lockOwner(initial.sourceId, tx)
					: undefined;
				const table = tableFor(initial.kind);
				const [row] = await getExecutor(tx)
					.select()
					.from(table)
					.where(eq(table.id, id))
					.for("update");
				if (["completed", "cancelled"].includes(row.status)) return map(row);
				if (owner?.runId === id)
					await getExecutor(tx)
						.update(owners)
						.set(emptyOwner)
						.where(eq(owners.sourceId, owner.sourceId));
				const [updated] = await getExecutor(tx)
					.update(table)
					.set({
						status: "cancelled",
						cancelRequestedAt: now,
						...emptyLease,
						updatedAt: now,
						finishedAt: now,
					})
					.where(eq(table.id, id))
					.returning();
				return map(updated);
			});
		},
		async retry(id) {
			return transactions.transaction(async (tx) => {
				await assertDedicated(tx);
				const initial = await repo.findById(id, tx);
				if (!initial) throw new ResourceNotFoundError("Source run", id);
				if (initial.sourceId) await lockOwner(initial.sourceId, tx);
				const table = tableFor(initial.kind);
				const [row] = await getExecutor(tx)
					.select()
					.from(table)
					.where(eq(table.id, id))
					.for("update");
				if (
					!row.input ||
					!row.sourceId ||
					!["failed", "cancelled"].includes(row.status)
				)
					throw new ResourceConflictError(
						"Only recoverable failed or cancelled source runs can be resumed",
					);
				const [expired] = await getExecutor(tx)
					.select({ id: table.id })
					.from(table)
					.where(and(eq(table.id, id), lte(table.retentionExpiresAt, now)));
				if (expired)
					throw new ResourceConflictError("Source input retention has expired");
				if (row.kind === "sync") {
					const [pending] = await getExecutor(tx)
						.select({ id: syncs.id })
						.from(syncs)
						.where(
							and(
								eq(syncs.sourceId, row.sourceId),
								eq(syncs.status, "pending"),
							),
						)
						.limit(1);
					if (pending)
						throw new ResourceConflictError("A newer sync is already queued");
				}
				const [updated] = await getExecutor(tx)
					.update(table)
					.set({
						status: "pending",
						failureCode: null,
						cancelRequestedAt: null,
						...emptyLease,
						maxAttempts: row.attemptCount + 3,
						updatedAt: now,
						finishedAt: null,
					})
					.where(eq(table.id, id))
					.returning();
				return map(updated);
			});
		},
		async cleanupExpired(limit, remove) {
			const candidates = await getExecutor()
				.select()
				.from(transfers)
				.where(lte(transfers.retentionExpiresAt, now))
				.orderBy(asc(transfers.retentionExpiresAt))
				.limit(limit);
			let removed = 0;
			for (const candidate of candidates)
				await transactions.transaction(async (tx) => {
					await assertDedicated(tx);
					const owner = candidate.sourceId
						? await lockOwner(candidate.sourceId, tx)
						: undefined;
					const [row] = await getExecutor(tx)
						.select()
						.from(transfers)
						.where(
							and(
								eq(transfers.id, candidate.id),
								lte(transfers.retentionExpiresAt, now),
							),
						)
						.for("update");
					if (!row) return;
					if (owner?.runId === row.id) {
						const [live] = await getExecutor(tx)
							.select({ id: owners.runId })
							.from(owners)
							.where(
								and(
									eq(owners.sourceId, owner.sourceId),
									gt(owners.expiresAt, now),
								),
							);
						if (live) return;
						await getExecutor(tx)
							.update(owners)
							.set(emptyOwner)
							.where(eq(owners.sourceId, owner.sourceId));
					}
					await remove(map(row));
					await getExecutor(tx)
						.update(transfers)
						.set({
							input: null,
							artifact: null,
							retentionExpiresAt: null,
							...emptyLease,
							...(["pending", "in_progress", "failed"].includes(row.status)
								? { status: "blocked" as const, failureCode: "input_expired" }
								: {}),
							updatedAt: now,
						})
						.where(eq(transfers.id, row.id));
					removed++;
				});
			return removed;
		},
		rollback: () => rollbackSourceRuns(getExecutor),
	};
	return repo;
}
