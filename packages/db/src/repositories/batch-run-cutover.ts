import { and, asc, count, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { ResourceConflictError } from "@solid-imager/core/domain/errors";
import { mediaProcessingCheckpointSchema } from "@solid-imager/core/domain/jobs/schemas";
import {
	batchInputSchema,
	retiredBatchJobTypes,
	type BatchInput,
	type BatchItem,
	type BatchRun,
} from "@solid-imager/core/domain/batches/schemas";
import {
	scheduledMediaInputSchema,
	type MediaTaskKind,
} from "@solid-imager/core/domain/processing/schemas";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { IBatchRunRepository } from "@solid-imager/core/domain/repositories/batch-run-repository";
import { isRecord } from "@solid-imager/core/utils/type-guards";
import {
	batchRuns as runs,
	batchItems as items,
	batchItemAttempts as attempts,
	batchRunCutovers as controls,
	batchRunLegacySnapshots as archives,
	jobs,
	mediaSources,
	mediaProcessingStates as states,
} from "../schema";
import { createTransactionManager } from "../transaction-manager";
import type { DrizzleExecutor } from "../types";

const now = sql`timezone('UTC', clock_timestamp())`;
const CONTROL_ID = "79000000-0000-4000-8000-000000000001";
const parents = [
	"bulk_tagging_parent",
	"batch_ccip_parent",
	"thumbnail_generation_parent",
];
const dispatchers = ["bulk_tagging_dispatch", "batch_ccip_dispatch"];
const identitySchema = z.object({
	requestId: z.uuid(),
	requestedRevision: z.string(),
});
const targetPayloadSchema = z.looseObject({
	mediaId: z.uuid().optional(),
	mediaIds: z.array(z.uuid()).max(5000).optional(),
});
const legacySummarySchema = z.looseObject({
	id: z.uuid(),
	type: z.string(),
	status: z.string(),
	payload: z.unknown(),
	source_id: z.uuid().nullable(),
	parent_id: z.uuid().nullable(),
});
function decode(value: unknown): unknown {
	if (typeof value !== "string") return value;
	try {
		const parsed: unknown = JSON.parse(value);
		return parsed;
	} catch {
		return value;
	}
}
function rowsOf(value: unknown): unknown[] {
	return Array.isArray(value)
		? value
		: isRecord(value) && Array.isArray(value.rows)
			? value.rows
			: [];
}
function kindOf(type: string): BatchInput["kind"] {
	if (type.includes("tagging")) return "tagging";
	if (type.includes("ccip")) return "ccip";
	if (type.includes("thumbnail")) return "thumbnail";
	return "media";
}
function taskKinds(type: string, stateKinds: string[]): MediaTaskKind[] {
	const kind = kindOf(type);
	if (kind !== "media") return [kind];
	return ["metadata", "thumbnail"].filter((entry): entry is MediaTaskKind =>
		stateKinds.includes(entry),
	);
}
function terminal(status: string): boolean {
	return ["completed", "failed", "cancelled"].includes(status);
}
function requestIdentity(
	payload: unknown,
	mediaId: string,
	kind: MediaTaskKind,
) {
	if (!isRecord(payload)) return null;
	const candidates: unknown[] = [];
	if (isRecord(payload.processingRequests))
		candidates.push(payload.processingRequests[mediaId]);
	candidates.push(payload.processingRequest);
	if (isRecord(payload.checkpoint) && isRecord(payload.checkpoint.steps))
		candidates.push(payload.checkpoint.steps[kind]);
	for (const value of candidates) {
		const parsed = identitySchema.safeParse(value);
		if (parsed.success) return parsed.data;
	}
	return null;
}

/** The jobs table is locked and authority remains legacy throughout this bounded shadow conversion. */
export async function migrateLegacyBatches(
	db: DrizzleExecutor,
): Promise<{ migrated: number; blocked: number }> {
	const [oldCount] = await db
		.select({ value: count() })
		.from(jobs)
		.where(inArray(jobs.type, [...retiredBatchJobTypes]));
	let cursor: string | undefined;
	let blocked = 0;
	for (;;) {
		const keys = z.array(z.object({ id: z.uuid() })).parse(
			rowsOf(
				await db.execute(sql`
			WITH roots AS (
				SELECT DISTINCT CASE WHEN p.type IN ('bulk_tagging_parent','batch_ccip_parent','thumbnail_generation_parent') THEN j.parent_id ELSE j.id END AS id
				FROM jobs j LEFT JOIN jobs p ON p.id = j.parent_id WHERE j.type IN ${sql.join(
					[
						sql`(`,
						sql.join(
							retiredBatchJobTypes.map((type) => sql`${type}`),
							sql`, `,
						),
						sql`)`,
					],
					sql``,
				)}
			) SELECT id FROM roots ${cursor ? sql`WHERE id > ${cursor}::uuid` : sql``} ORDER BY id LIMIT 100
		`),
			),
		);
		if (!keys.length) break;
		for (const { id } of keys) {
			const [root] = await db.select().from(jobs).where(eq(jobs.id, id));
			if (!root)
				throw new ResourceConflictError("Legacy batch root is missing");
			const isParent = parents.includes(root.type);
			const payload = decode(root.payload);
			const parsedInput = batchInputSchema.safeParse({
				kind: kindOf(root.type),
				mediaSourceId: root.mediaSourceId ?? undefined,
				force: isRecord(payload) ? (payload.force ?? false) : false,
			});
			let reason: string | null = parsedInput.success ? null : "invalid_input";
			if (!terminal(root.status) && dispatchers.includes(root.type))
				reason = "legacy_scope_unfixed";
			if (isParent && !terminal(root.status)) {
				const dispatch = await db
					.select({ status: jobs.status })
					.from(jobs)
					.where(and(eq(jobs.parentId, id), inArray(jobs.type, dispatchers)));
				if (
					root.type !== "thumbnail_generation_parent" &&
					(!dispatch.length ||
						dispatch.some((row) => row.status !== "completed"))
				)
					reason = "legacy_scope_unfixed";
			}
			await db.insert(runs).values({
				id,
				input: parsedInput.success ? parsedInput.data : null,
				status: "blocked",
				blockedReason: "migration_pending",
				dispatchComplete: true,
				attemptCount: root.attemptCount,
				maxAttempts: root.attemptCount + 3,
				createdAt: root.createdAt,
				updatedAt: root.updatedAt,
			});
			let childCursor: string | undefined;
			let targetCount = 0;
			for (;;) {
				const members = await db
					.select()
					.from(jobs)
					.where(
						and(
							isParent ? eq(jobs.parentId, id) : eq(jobs.id, id),
							inArray(jobs.type, [...retiredBatchJobTypes]),
							childCursor ? gt(jobs.id, childCursor) : undefined,
						),
					)
					.orderBy(asc(jobs.id))
					.limit(250);
				if (!members.length) break;
				for (const member of members) {
					if (
						dispatchers.includes(member.type) ||
						parents.includes(member.type)
					)
						continue;
					const memberPayload = decode(member.payload);
					const target = targetPayloadSchema.safeParse(memberPayload);
					const mediaIds = target.success
						? (target.data.mediaIds ??
							(target.data.mediaId ? [target.data.mediaId] : []))
						: [];
					if (!mediaIds.length || !member.mediaSourceId) {
						reason ??= "invalid_target";
						continue;
					}
					for (const mediaId of [...mediaIds].sort()) {
						const currentStates = await db
							.select()
							.from(states)
							.where(eq(states.mediaId, mediaId))
							.for("update");
						const checkpoint =
							member.type === "processMedia"
								? mediaProcessingCheckpointSchema.safeParse(
										member.processingCheckpoint,
									)
								: null;
						const kinds: MediaTaskKind[] = checkpoint?.success
							? (["metadata", "thumbnail"] as const).filter(
									(kind) => checkpoint.data.steps[kind].status !== "skipped",
								)
							: taskKinds(
									member.type,
									currentStates.map((state) => state.taskKind),
								);
						if (!kinds.length) {
							reason ??= "legacy_request_unknown";
							continue;
						}
						for (const kind of kinds) {
							const current = currentStates.find(
								(state) => state.taskKind === kind,
							);
							const expected = requestIdentity(memberPayload, mediaId, kind);
							const matched =
								expected &&
								current?.requestId === expected.requestId &&
								current.requestedRevision === expected.requestedRevision;
							const input = scheduledMediaInputSchema.safeParse(
								current?.scheduledInput,
							);
							let status: BatchItem["status"];
							const historicalStep =
								checkpoint?.success &&
								(kind === "metadata" || kind === "thumbnail")
									? checkpoint.data.steps[kind]
									: null;
							if (
								historicalStep?.status === "completed" ||
								member.status === "completed"
							)
								status = "completed";
							else if (
								member.status === "cancelled" ||
								member.cancelRequestedAt
							)
								status = "cancelled";
							else if (member.status === "failed") status = "failed";
							else if (matched && input.success)
								status =
									current.status === "completed" || current.status === "failed"
										? current.status
										: "scheduled";
							else {
								status = "blocked";
								reason ??= "legacy_request_unknown";
							}
							if (status !== "completed" && (!matched || !input.success))
								reason ??= "legacy_request_unknown";
							const [item] = await db
								.insert(items)
								.values({
									id:
										isParent && mediaIds.length === 1 && kinds.length === 1
											? member.id
											: undefined,
									runId: id,
									mediaId,
									mediaSourceId: member.mediaSourceId,
									kind,
									input: matched && input.success ? input.data : null,
									plannedRevision: expected?.requestedRevision ?? null,
									requestId: expected?.requestId ?? null,
									requestedRevision: expected?.requestedRevision ?? null,
									status,
									attemptCount: expected ? 1 : 0,
									failureCode: ["failed", "blocked"].includes(status)
										? "processing_failed"
										: null,
									createdAt: member.createdAt,
									updatedAt: member.updatedAt,
									finishedAt: status === "scheduled" ? null : member.updatedAt,
								})
								.onConflictDoNothing()
								.returning();
							if (!item) {
								reason ??= "ambiguous_target";
								continue;
							}
							targetCount++;
							if (expected)
								await db.insert(attempts).values({
									itemId: item.id,
									attemptCount: 1,
									requestId: expected.requestId,
									requestedRevision: expected.requestedRevision,
									status,
									failureCode: item.failureCode,
									createdAt: member.createdAt,
									finishedAt: item.finishedAt,
								});
							if (
								!terminal(member.status) &&
								!["pending", "in_progress"].includes(member.status)
							)
								reason ??= "unknown_legacy_status";
						}
					}
				}
				childCursor = members.at(-1)?.id;
				if (!isParent) break;
			}
			if (
				isParent &&
				isRecord(payload) &&
				typeof payload.total === "number" &&
				payload.total > targetCount
			)
				reason ??= "legacy_target_set_incomplete";
			const status: BatchRun["status"] = reason
				? "blocked"
				: terminal(root.status)
					? root.status === "completed"
						? "completed"
						: root.status === "cancelled"
							? "cancelled"
							: "failed"
					: "in_progress";
			await db
				.update(runs)
				.set({
					status,
					blockedReason: reason,
					finishedAt:
						terminal(status) || status === "blocked"
							? (root.finishedAt ?? root.updatedAt)
							: null,
				})
				.where(eq(runs.id, id));
			if (reason) blocked++;
			const scope = isParent
				? sql`(id = ${id}::uuid OR parent_id = ${id}::uuid)`
				: sql`id = ${id}::uuid`;
			await db.execute(
				sql`INSERT INTO batch_run_legacy_snapshots (id, run_id, snapshot) SELECT id, ${id}::uuid, to_jsonb(jobs) FROM jobs WHERE ${scope} AND type IN ${sql.join(
					[
						sql`(`,
						sql.join(
							retiredBatchJobTypes.map((type) => sql`${type}`),
							sql`, `,
						),
						sql`)`,
					],
					sql``,
				)}`,
			);
		}
		cursor = keys.at(-1)?.id;
	}
	const [archived] = await db.select({ value: count() }).from(archives);
	const shadow = z.object({ value: z.coerce.number().int() }).parse(
		rowsOf(
			await db.execute(sql`
		SELECT count(*) AS value FROM jobs j WHERE j.type IN ${sql.join(
			[
				sql`(`,
				sql.join(
					retiredBatchJobTypes.map((type) => sql`${type}`),
					sql`, `,
				),
				sql`)`,
			],
			sql``,
		)}
		AND NOT EXISTS (SELECT 1 FROM batch_run_legacy_snapshots a WHERE a.id = j.id AND a.snapshot = to_jsonb(j))
	`),
		)[0],
	);
	if (archived?.value !== oldCount?.value || shadow.value !== 0)
		throw new ResourceConflictError("Batch backfill shadow comparison failed");
	return { migrated: oldCount?.value ?? 0, blocked };
}

export async function rollbackLegacyBatches(
	getExecutor: (tx?: Transaction) => DrizzleExecutor,
	repository: IBatchRunRepository,
): Promise<{ restored: number }> {
	return createTransactionManager(() => getExecutor()).transaction(
		async (tx) => {
			const db = getExecutor(tx);
			await db.execute(sql`LOCK TABLE jobs IN SHARE ROW EXCLUSIVE MODE`);
			const [control] = await db
				.select()
				.from(controls)
				.where(eq(controls.id, CONTROL_ID))
				.for("update");
			if (control?.authority !== "dedicated")
				throw new ResourceConflictError(
					"Batch rollback requires dedicated authority",
				);
			const live = z.object({ value: z.coerce.number().int() }).parse(
				rowsOf(
					await db.execute(sql`
			SELECT count(*) AS value FROM batch_runs WHERE lease_expires_at > ${now}
			UNION ALL SELECT count(*) AS value FROM media_processing_states s WHERE s.status = 'in_progress' AND s.heartbeat_at > ${now} - interval '120 seconds'
			AND EXISTS (SELECT 1 FROM batch_items i WHERE i.request_id = s.request_id AND i.kind = s.task_kind)
		`),
				).find(
					(row) => z.object({ value: z.coerce.number() }).parse(row).value > 0,
				) ?? { value: 0 },
			);
			if (live.value)
				throw new ResourceConflictError(
					"Live batch processing must drain before rollback",
				);
			await db
				.update(controls)
				.set({
					authority: "legacy",
					generation: control.generation + 1,
					updatedAt: now,
				})
				.where(eq(controls.id, CONTROL_ID));
			let restored = 0;
			let cursor: string | undefined;
			for (;;) {
				const rows = await db
					.select()
					.from(runs)
					.where(cursor ? gt(runs.id, cursor) : undefined)
					.orderBy(asc(runs.id))
					.limit(100);
				if (!rows.length) break;
				for (const row of rows) {
					const current = await repository.findById(row.id, tx);
					if (!current)
						throw new ResourceConflictError(
							"Batch disappeared during rollback",
						);
					let archiveCursor: string | undefined;
					const [archiveCount] = await db
						.select({ value: count() })
						.from(archives)
						.where(eq(archives.runId, row.id));
					if (archiveCount?.value) {
						// Parent first, then its archived dispatch/child rows, keeping old IDs and all unknown columns.
						const rootArchive = await db
							.select()
							.from(archives)
							.where(and(eq(archives.runId, row.id), eq(archives.id, row.id)));
						if (rootArchive[0])
							restored += await restoreArchived(
								db,
								rootArchive[0].snapshot,
								current.run,
							);
						for (;;) {
							const originals = await db
								.select()
								.from(archives)
								.where(
									and(
										eq(archives.runId, row.id),
										sql`${archives.id} <> ${row.id}`,
										archiveCursor ? gt(archives.id, archiveCursor) : undefined,
									),
								)
								.orderBy(asc(archives.id))
								.limit(250);
							if (!originals.length) break;
							for (const original of originals)
								restored += await restoreArchived(
									db,
									original.snapshot,
									current.run,
								);
							archiveCursor = originals.at(-1)?.id;
						}
					} else {
						restored += await restoreNative(db, current.run, current.progress);
					}
				}
				cursor = rows.at(-1)?.id;
			}
			// Paused batch-only requests become visible failures, never pending work on an old scheduler.
			await db.execute(sql`UPDATE media_processing_states s SET status = 'failed', claim_token = NULL, claimed_at = NULL, heartbeat_at = NULL,
			last_error = 'Batch request was paused during rollback', owner_job_id = NULL, owner_attempt_count = NULL
			WHERE NOT independent_demand AND status IN ('pending','in_progress') AND NOT EXISTS (
				SELECT 1 FROM batch_items i JOIN batch_runs r ON r.id = i.run_id WHERE i.request_id = s.request_id AND i.kind = s.task_kind
				AND i.status = 'scheduled' AND r.status IN ('pending','in_progress')
			)`);
			await db.execute(
				sql`UPDATE media_processing_states SET independent_demand = true WHERE NOT independent_demand`,
			);
			return { restored };
		},
	);
}

async function restoreArchived(
	db: DrizzleExecutor,
	snapshot: unknown,
	run: BatchRun,
): Promise<number> {
	const original = legacySummarySchema.parse(snapshot);
	const decoded = decode(original.payload);
	const payload = isRecord(decoded) ? { ...decoded } : {};
	let status =
		run.status === "blocked" || run.status === "failed"
			? "failed"
			: run.status === "cancelled"
				? "cancelled"
				: run.status === "completed"
					? "completed"
					: parents.includes(original.type)
						? "in_progress"
						: dispatchers.includes(original.type)
							? "completed"
							: "pending";
	if (
		!parents.includes(original.type) &&
		!dispatchers.includes(original.type)
	) {
		const target = targetPayloadSchema.safeParse(payload);
		const ids = target.success
			? (target.data.mediaIds ??
				(target.data.mediaId ? [target.data.mediaId] : []))
			: [];
		const outcomes = ids.length
			? await db
					.select()
					.from(items)
					.where(and(eq(items.runId, run.id), inArray(items.mediaId, ids)))
			: [];
		if (
			outcomes.length &&
			outcomes.every((item) => item.status === "completed")
		)
			status = "completed";
		else if (
			outcomes.some(
				(item) => item.status === "pending" || item.status === "scheduled",
			) &&
			!["blocked", "cancelled"].includes(run.status)
		)
			status = "pending";
		if (
			original.type === "auto_tagging" ||
			original.type === "extract_ccip_vector"
		)
			payload.processingRequests = Object.fromEntries(
				outcomes
					.filter((item) => item.requestId && item.requestedRevision)
					.map((item) => [
						item.mediaId,
						{
							requestId: item.requestId,
							requestedRevision: item.requestedRevision,
						},
					]),
			);
		if (original.type === "generate_thumbnail" && outcomes[0]?.requestId)
			payload.processingRequest = {
				requestId: outcomes[0].requestId,
				requestedRevision: outcomes[0].requestedRevision,
			};
		payload.force = false;
		payload.retryAiTasks = false;
		payload.retryFileTasks = false;
	}
	if (original.status === "completed") status = "completed";
	const projected = {
		...original,
		status,
		payload,
		cancel_requested_at:
			status === "cancelled" ? new Date().toISOString() : null,
		cancelled_at: status === "cancelled" ? new Date().toISOString() : null,
		started_at: null,
		finished_at: terminal(status) ? new Date().toISOString() : null,
	};
	if (original.source_id) {
		const [source] = await db
			.select({ id: mediaSources.id })
			.from(mediaSources)
			.where(eq(mediaSources.id, original.source_id));
		if (!source) {
			projected.source_id = null;
			if (!terminal(status)) projected.status = "failed";
		}
	}
	await db.execute(
		sql`INSERT INTO jobs SELECT * FROM jsonb_populate_record(NULL::jobs, ${JSON.stringify(projected)}::jsonb)`,
	);
	return 1;
}

async function restoreNative(
	db: DrizzleExecutor,
	run: BatchRun,
	progress: {
		total: number;
		completed: number;
		failed: number;
		cancelled: number;
	},
): Promise<number> {
	if (!run.input)
		throw new ResourceConflictError(
			"Native batch without input cannot roll back",
		);
	const kind = run.input.kind;
	if (kind === "media")
		throw new ResourceConflictError(
			"Legacy-only media runs require their archived snapshot for rollback",
		);
	const type =
		kind === "tagging"
			? "bulk_tagging_parent"
			: kind === "ccip"
				? "batch_ccip_parent"
				: "thumbnail_generation_parent";
	const parentSource = run.input.mediaSourceId
		? ((
				await db
					.select({ id: mediaSources.id })
					.from(mediaSources)
					.where(eq(mediaSources.id, run.input.mediaSourceId))
			)[0]?.id ?? null)
		: null;
	await db.insert(jobs).values({
		id: run.id,
		type,
		mediaSourceId: parentSource,
		status:
			run.status === "blocked"
				? "failed"
				: run.status === "pending"
					? "in_progress"
					: run.status,
		payload: {
			mediaSourceId: run.input.mediaSourceId,
			total: progress.total,
			processed: progress.completed,
			failed: progress.failed,
			force: false,
		},
		createdAt: run.createdAt,
		updatedAt: run.updatedAt,
		attemptCount: run.attemptCount,
	});
	let cursor: string | undefined;
	let restored = 1;
	for (;;) {
		const rows = await db
			.select()
			.from(items)
			.where(
				and(eq(items.runId, run.id), cursor ? gt(items.id, cursor) : undefined),
			)
			.orderBy(asc(items.id))
			.limit(250);
		if (!rows.length) break;
		for (const item of rows) {
			const sourceId =
				(
					await db
						.select({ id: mediaSources.id })
						.from(mediaSources)
						.where(eq(mediaSources.id, item.mediaSourceId))
				)[0]?.id ?? null;
			const status =
				item.status === "completed"
					? "completed"
					: item.status === "cancelled"
						? "cancelled"
						: ["failed", "superseded", "blocked"].includes(item.status)
							? "failed"
							: "pending";
			const request =
				item.requestId && item.requestedRevision
					? {
							requestId: item.requestId,
							requestedRevision: item.requestedRevision,
						}
					: undefined;
			await db.insert(jobs).values({
				id: item.id,
				parentId: run.id,
				type:
					item.kind === "tagging"
						? "auto_tagging"
						: item.kind === "ccip"
							? "extract_ccip_vector"
							: "generate_thumbnail",
				mediaSourceId: sourceId,
				status: !sourceId && status === "pending" ? "failed" : status,
				payload: {
					mediaId: item.mediaId,
					force: false,
					size: run.input.thumbnailSize,
					...(item.kind === "thumbnail"
						? { processingRequest: request }
						: {
								processingRequests: request
									? { [item.mediaId]: request }
									: undefined,
							}),
				},
				attemptCount: item.attemptCount,
				createdAt: item.createdAt,
				updatedAt: item.updatedAt,
			});
			restored++;
		}
		cursor = rows.at(-1)?.id;
	}
	return restored;
}
