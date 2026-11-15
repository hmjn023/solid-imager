import {
	importAiStages,
	type ImportBatchContext,
} from "@solid-imager/core/jobs";
import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { jobs } from "../schema";
import type { DrizzleExecutor } from "../types";

type Executor = Pick<DrizzleExecutor, "select" | "update" | "insert">;

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
						payload: sql`jobs.payload || jsonb_build_object('total',(jobs.payload->>'total')::int + ${items.length}::int, 'processed', (jobs.payload->>'processed')::int + ${skipped}::int)`,
						updatedAt: new Date(),
					},
					setWhere: sql`jobs.payload->>'collecting'='true' AND jobs.status='in_progress'`,
				})
				.returning()
		: await insert.returning();
	if (!parent) throw new Error("Directory scan is closed");
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
	const key = failed ? "failed" : "processed";
	const done = sql`coalesce(payload->>'collecting','false') <> 'true' AND (payload->>'processed')::int + (payload->>'failed')::int + 1 >= (payload->>'total')::int`;
	await tx
		.update(jobs)
		.set({
			payload: sql`payload || jsonb_build_object(${key}::text, (payload->>${key})::int + 1)`,
			status: sql`CASE WHEN ${done} THEN (CASE WHEN cancel_requested_at IS NOT NULL THEN 'cancelled' WHEN payload->>'scanFailed'='true' OR ${!!failed} OR (payload->>'failed')::int > 0 THEN 'failed' ELSE 'completed' END)::job_status ELSE status END`,
			finishedAt: sql`CASE WHEN ${done} THEN NOW() ELSE NULL END`,
			cancelledAt: sql`CASE WHEN ${done} AND cancel_requested_at IS NOT NULL THEN NOW() END`,
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
		SELECT 1 FROM jobs root WHERE root.id = CASE WHEN pg_input_is_valid(jobs.payload->>'importBatchId', 'uuid') THEN (jobs.payload->>'importBatchId')::uuid END AND root.payload->>'collecting' = 'true'
	)) AND ${sql.join(guards, sql` AND `)}))`;
}

/** A download can yield multiple files. Give each resulting medium a stable target. */
export async function bindImportMedia(
	tx: Executor,
	owner: ImportBatchContext,
	mediaId: string,
) {
	const [target] = await tx
		.select()
		.from(jobs)
		.where(eq(jobs.id, owner.importTargetId))
		.for("update");
	const payload = target?.payload;
	if (!target || !payload || typeof payload !== "object")
		throw new Error("Missing import target");
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
				sql`payload->>'origin' = ${target.id} AND payload->>'mediaId' = ${mediaId}`,
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
	await tx
		.update(jobs)
		.set({
			payload: sql`payload || jsonb_build_object('total', (payload->>'total')::int + 1)`,
		})
		.where(eq(jobs.id, owner.importBatchId));
	return created.id;
}

export async function sealImportScan(
	tx: Executor,
	condition: SQL,
	interrupted = false,
) {
	const done = sql`(payload->>'processed')::int + (payload->>'failed')::int >= (payload->>'total')::int`;
	await tx
		.update(jobs)
		.set({
			payload: sql`(payload - 'collecting') || CASE WHEN ${interrupted} THEN '{"scanFailed":true}'::jsonb ELSE '{}'::jsonb END`,
			error: interrupted ? "Directory scan interrupted" : null,
			status: sql`CASE WHEN ${done} THEN (CASE WHEN ${interrupted} OR (payload->>'failed')::int > 0 THEN 'failed' ELSE 'completed' END)::job_status ELSE status END`,
			finishedAt: sql`CASE WHEN ${done} THEN NOW() ELSE NULL END`,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(jobs.type, "import_batch_parent"),
				sql`payload->>'collecting' = 'true'`,
				condition,
			),
		);
}
