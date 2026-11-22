import {
	importAiStages,
	type ImportBatchContext,
} from "@solid-imager/core/jobs";
import { isRecord } from "@solid-imager/core/utils";
import {
	and,
	eq,
	inArray,
	isNotNull,
	isNull,
	lt,
	sql,
	type SQL,
} from "drizzle-orm";
import { jobs } from "../schema";
import { normalizedPayloadExpression } from "./job-payload";
import type { DrizzleExecutor } from "../types";

type Executor = Pick<
	DrizzleExecutor,
	"select" | "update" | "insert" | "execute"
>;

/** Prevent new descendants appearing mid-cancellation. Finishers keep their work → target → root lock order. */
export async function lockBatchAdmissions(
	tx: Pick<Executor, "execute">,
	id: string,
	exclusive = false,
) {
	const key = sql`hashtextextended(${id}::text, 0)`;
	await tx.execute(
		exclusive
			? sql`SELECT pg_advisory_xact_lock(${key})`
			: sql`SELECT pg_advisory_xact_lock_shared(${key})`,
	);
}

export class ClosedImportScanError extends Error {}

/** Serialize approvals for the same destination before checking its active downloads. */
export async function lockActiveDownloadUrls(
	tx: Executor,
	mediaSourceId: string,
	urls: string[],
): Promise<Set<string>> {
	const key = sql`hashtextextended('solid-imager:import-destination:' || ${mediaSourceId}::uuid::text, 0)`;
	await tx.execute(sql`SELECT pg_advisory_xact_lock(${key})`);
	if (urls.length === 0) return new Set();
	const targetUrl = sql<string>`${normalizedPayloadExpression()}->>'targetUrl'`;
	const active = await tx
		.select({ targetUrl })
		.from(jobs)
		.where(
			and(
				eq(jobs.mediaSourceId, mediaSourceId),
				eq(jobs.type, "downloadImage"),
				inArray(jobs.status, ["pending", "in_progress"]),
				isNull(jobs.cancelRequestedAt),
				inArray(targetUrl, urls),
			),
		);
	return new Set(active.map((job) => job.targetUrl));
}

/** All target reservations and their first work are published by the caller's transaction. */
export async function createImportBatch(
	tx: Executor,
	mediaSourceId: string,
	items: {
		label: string;
		work: typeof jobs.$inferInsert;
		mediaId?: string;
		skipped?: boolean;
	}[],
	scanId?: string,
) {
	if (scanId) await lockBatchAdmissions(tx, scanId);
	const payload = normalizedPayloadExpression(sql`jobs.payload`);
	const skipped = items.filter((item) => item.skipped).length;
	const insert = tx.insert(jobs).values({
		id: scanId,
		type: "import_batch_parent",
		mediaSourceId,
		updatedAt: new Date(),
		status: !scanId && skipped === items.length ? "completed" : "in_progress",
		finishedAt: !scanId && skipped === items.length ? new Date() : null,
		payload: {
			total: items.length,
			processed: skipped,
			failed: 0,
			...(scanId ? { collecting: true } : {}),
		},
	});
	const [parent] = scanId
		? await insert
				.onConflictDoUpdate({
					target: jobs.id,
					set: {
						payload: sql`${payload} || jsonb_build_object('total',(${payload}->>'total')::int + ${items.length}::int, 'processed', (${payload}->>'processed')::int + ${skipped}::int)`,
						updatedAt: new Date(),
					},
					setWhere: sql`${payload}->>'collecting'='true' AND jobs.status='in_progress' AND jobs.cancel_requested_at IS NULL`,
				})
				.returning()
		: await insert.returning();
	if (!parent) throw new ClosedImportScanError("Directory scan is closed");
	for (let offset = 0; offset < items.length; offset += 250) {
		const page = items.slice(offset, offset + 250);
		const targets = page.map((item) => ({
			id: crypto.randomUUID(),
			type: "import_batch_target",
			parentId: parent.id,
			mediaSourceId,
			status: item.skipped ? ("completed" as const) : ("in_progress" as const),
			payload: {
				label: item.label,
				skipped: !!item.skipped,
				...(item.mediaId ? { mediaId: item.mediaId } : {}),
			},
			finishedAt: item.skipped ? new Date() : null,
		}));
		await tx.insert(jobs).values(targets);
		const work = page.flatMap((item, index) => {
			const context = {
				importBatchId: parent.id,
				importTargetId: targets[index].id,
			};
			return item.skipped
				? []
				: [
						{
							...item.work,
							updatedAt: new Date(),
							parentId: context.importTargetId,
							mediaSourceId,
							payload: {
								...(typeof item.work.payload === "object"
									? item.work.payload
									: {}),
								...context,
							},
						},
					];
		});
		if (work.length) await tx.insert(jobs).values(work);
	}
	return { id: parent.id };
}

/** Called after the work CAS in the same transaction, including cancellation and recovery. */
export async function settleImportTarget(
	tx: Executor,
	context: ImportBatchContext,
) {
	const [target] = await tx
		.select({ status: jobs.status })
		.from(jobs)
		.where(
			and(
				eq(jobs.id, context.importTargetId),
				eq(jobs.parentId, context.importBatchId),
				eq(jobs.type, "import_batch_target"),
			),
		)
		.for("update");
	if (target?.status !== "in_progress") return;
	const [open] = await tx
		.select({ id: jobs.id })
		.from(jobs)
		.where(
			and(
				eq(jobs.parentId, context.importTargetId),
				inArray(jobs.status, ["pending", "in_progress"]),
			),
		)
		.limit(1);
	if (open) return;
	const [failed] = await tx
		.select({ status: jobs.status })
		.from(jobs)
		.where(
			and(
				eq(jobs.parentId, context.importTargetId),
				inArray(jobs.status, ["failed", "cancelled"]),
			),
		)
		.orderBy(sql`(${jobs.status}='failed') DESC`)
		.limit(1);
	await tx
		.update(jobs)
		.set({
			status: failed?.status ?? "completed",
			cancelledAt: failed?.status === "cancelled" ? new Date() : null,
			updatedAt: new Date(),
			finishedAt: new Date(),
		})
		.where(eq(jobs.id, context.importTargetId));
	const key =
		failed?.status === "cancelled"
			? "cancelled"
			: failed
				? "failed"
				: "processed";
	const payload = normalizedPayloadExpression();
	const done = sql`coalesce(${payload}->>'collecting','false') <> 'true' AND (${payload}->>'processed')::int + (${payload}->>'failed')::int + coalesce((${payload}->>'cancelled')::int,0) + 1 >= (${payload}->>'total')::int`;
	await tx
		.update(jobs)
		.set({
			payload: sql`${payload} || jsonb_build_object(${key}::text, coalesce((${payload}->>${key})::int,0) + 1)`,
			status: sql`CASE WHEN ${done} THEN (CASE WHEN cancel_requested_at IS NOT NULL THEN 'cancelled' WHEN ${payload}->>'scanFailed'='true' OR ${key === "failed"} OR (${payload}->>'failed')::int > 0 THEN 'failed' WHEN ${key === "cancelled"} OR coalesce((${payload}->>'cancelled')::int,0)>0 THEN 'cancelled' ELSE 'completed' END)::job_status ELSE status END`,
			finishedAt: sql`CASE WHEN ${done} THEN NOW() ELSE NULL END`,
			cancelledAt: sql`CASE WHEN ${done} AND (cancel_requested_at IS NOT NULL OR coalesce((${payload}->>'cancelled')::int,0)>0 OR ${key === "cancelled"}) THEN NOW() END`,
			updatedAt: new Date(),
		})
		.where(
			and(eq(jobs.id, context.importBatchId), eq(jobs.status, "in_progress")),
		);
}

/** A preparation job stays active until it has persisted all enabled follow-up stages. */
export function importStageReady() {
	const prerequisites: string[] = [
		"downloadImage",
		"processMedia",
		"import_upload",
		"import_register",
	];
	const guards = importAiStages.map((types) => {
		const current = sql.join(
			types.map((type) => sql`${type}`),
			sql`,`,
		);
		const prior = sql.join(
			prerequisites.map((type) => sql`${type}`),
			sql`,`,
		);
		prerequisites.push(...types);
		return sql`(jobs.type NOT IN (${current}) OR NOT EXISTS (
			SELECT 1 FROM jobs prev WHERE prev.payload->>'importBatchId' = jobs.payload->>'importBatchId'
			AND prev.status IN ('pending','in_progress') AND prev.type IN (${prior})
		))`;
	});
	return sql`(jobs.payload->>'importBatchId' IS NULL OR ((jobs.type IN ('downloadImage','processMedia') OR NOT EXISTS (
		SELECT 1 FROM jobs root WHERE root.id = CASE WHEN pg_input_is_valid(jobs.payload->>'importBatchId', 'uuid') THEN (jobs.payload->>'importBatchId')::uuid END AND ${normalizedPayloadExpression(sql`root.payload`)}->>'collecting' = 'true'
	)) AND ${sql.join(guards, sql` AND `)}))`;
}

/** A download can yield multiple files. Give each resulting medium a stable target. */
export async function bindImportMedia(
	tx: Executor,
	owner: ImportBatchContext,
	mediaId: string,
) {
	const targetPayload = normalizedPayloadExpression();
	const [target] = await tx
		.select({
			id: jobs.id,
			mediaSourceId: jobs.mediaSourceId,
			payload: targetPayload,
		})
		.from(jobs)
		.where(and(eq(jobs.id, owner.importTargetId), isNotNull(jobs.payload)))
		.for("update");
	const payload = target?.payload;
	if (!target || !isRecord(payload)) throw new Error("Missing import target");
	if (!("mediaId" in payload) || payload.mediaId === mediaId) {
		await tx
			.update(jobs)
			.set({ payload: { ...payload, mediaId } })
			.where(eq(jobs.id, target.id));
		return target.id;
	}
	const [existing] = await tx
		.select({ id: jobs.id })
		.from(jobs)
		.where(
			and(
				eq(jobs.parentId, owner.importBatchId),
				eq(jobs.type, "import_batch_target"),
				sql`${targetPayload}->>'origin' = ${target.id} AND ${targetPayload}->>'mediaId' = ${mediaId}`,
			),
		)
		.limit(1);
	if (existing) return existing.id;
	const [created] = await tx
		.insert(jobs)
		.values({
			type: "import_batch_target",
			parentId: owner.importBatchId,
			mediaSourceId: target.mediaSourceId,
			status: "in_progress",
			payload: { ...payload, mediaId, origin: target.id },
		})
		.returning();
	const parentPayload = normalizedPayloadExpression();
	await tx
		.update(jobs)
		.set({
			payload: sql`${parentPayload} || jsonb_build_object('total', (${parentPayload}->>'total')::int + 1)`,
		})
		.where(eq(jobs.id, owner.importBatchId));
	return created.id;
}

export async function sealImportScan(
	tx: Executor,
	condition: SQL,
	interrupted = false,
) {
	const payload = normalizedPayloadExpression();
	const done = sql`(${payload}->>'processed')::int + (${payload}->>'failed')::int + coalesce((${payload}->>'cancelled')::int,0) >= (${payload}->>'total')::int`;
	await tx
		.update(jobs)
		.set({
			payload: sql`(${payload} - 'collecting') || CASE WHEN ${interrupted} THEN '{"scanFailed":true}'::jsonb ELSE '{}'::jsonb END`,
			error: interrupted ? "Directory scan interrupted" : null,
			status: sql`CASE WHEN ${done} THEN (CASE WHEN ${interrupted} OR (${payload}->>'failed')::int > 0 THEN 'failed' WHEN coalesce((${payload}->>'cancelled')::int,0)>0 THEN 'cancelled' ELSE 'completed' END)::job_status ELSE status END`,
			finishedAt: sql`CASE WHEN ${done} THEN NOW() ELSE NULL END`,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(jobs.type, "import_batch_parent"),
				sql`${payload}->>'collecting' = 'true'`,
				condition,
			),
		);
}

/** A legacy JSONB string concatenated with counter updates produced an array of patches. */
function readImportMetadata(payload: unknown) {
	let metadata: Record<string, unknown> = {};
	const parts: readonly unknown[] = Array.isArray(payload)
		? payload
		: [payload];
	for (let part of parts) {
		if (typeof part === "string") {
			try {
				part = JSON.parse(part);
			} catch {
				return null;
			}
		}
		if (!isRecord(part)) return null;
		metadata = { ...metadata, ...part };
	}
	return metadata;
}

/** Rebuild stranded imports from their terminal targets after ordinary work recovery has committed. */
export async function reconcileStaleImportBatches(
	db: DrizzleExecutor,
	olderThan: Date,
) {
	const stale = and(
		eq(jobs.type, "import_batch_parent"),
		eq(jobs.status, "in_progress"),
		lt(jobs.updatedAt, olderThan),
	);
	const candidates = await db
		.select({ id: jobs.id })
		.from(jobs)
		.where(
			and(
				stale,
				sql`EXISTS (SELECT 1 FROM jobs t WHERE t.parent_id=jobs.id AND t.type='import_batch_target')`,
				sql`NOT EXISTS (SELECT 1 FROM jobs t WHERE t.parent_id=jobs.id AND t.status IN ('pending','in_progress'))`,
			),
		)
		.orderBy(jobs.id);
	for (const { id } of candidates) {
		await db.transaction(async (tx) => {
			// Follow the cancellation/retry lock order, then take a fresh descendant
			// snapshot. A concurrent admission or last finisher may have changed it.
			await lockBatchAdmissions(tx, id, true);
			const [parent] = await tx
				.select({
					payload: normalizedPayloadExpression(),
					cancelRequestedAt: jobs.cancelRequestedAt,
					finishedAt: jobs.finishedAt,
					updatedAt: jobs.updatedAt,
					error: jobs.error,
				})
				.from(jobs)
				.where(and(stale, eq(jobs.id, id)))
				.for("update");
			if (!parent) return;
			const metadata = readImportMetadata(parent.payload);
			if (!metadata) return;
			const [targets] = await tx
				.select({
					total: sql<number>`count(*)::int`,
					processed: sql<number>`count(*) FILTER (WHERE status='completed')::int`,
					failed: sql<number>`count(*) FILTER (WHERE status='failed')::int`,
					cancelled: sql<number>`count(*) FILTER (WHERE status='cancelled')::int`,
					lastFinished: sql`max(coalesce(finished_at, updated_at))`.mapWith(
						jobs.updatedAt,
					),
				})
				.from(jobs)
				.where(eq(jobs.parentId, id)).having(sql`
				count(*) > 0 AND bool_and(type='import_batch_target' AND status IN ('completed','failed','cancelled'))
				AND NOT EXISTS (SELECT 1 FROM jobs t JOIN jobs w ON w.parent_id=t.id
					WHERE t.parent_id=${id}::uuid AND w.status IN ('pending','in_progress'))`);
			if (!targets) return;
			const { collecting, ...flags } = metadata;
			const { lastFinished, ...counts } = targets;
			const interrupted = collecting === true;
			const status = parent.cancelRequestedAt
				? "cancelled"
				: interrupted ||
					  flags.scanFailed === true ||
					  parent.error !== null ||
					  counts.failed
					? "failed"
					: counts.cancelled
						? "cancelled"
						: "completed";
			const finishedAt =
				parent.finishedAt ??
				new Date(Math.max(parent.updatedAt.getTime(), lastFinished.getTime()));
			await tx
				.update(jobs)
				.set({
					payload: {
						...flags,
						...counts,
						...(interrupted && { scanFailed: true }),
					},
					status,
					error: interrupted ? "Directory scan interrupted" : parent.error,
					finishedAt,
					cancelledAt: status === "cancelled" ? finishedAt : null,
					updatedAt: new Date(),
				})
				.where(eq(jobs.id, id));
		});
	}
}
