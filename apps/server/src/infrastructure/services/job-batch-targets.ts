import {
	batchTargetsSchema,
	importAiStages,
	importStageTypeSchema,
	type JobStatus,
} from "@solid-imager/core/jobs";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "~/infrastructure/db";
import { jobs, medias } from "~/infrastructure/db/schema";

async function listImportStages(id: string) {
	const target = alias(jobs, "import_target");
	const batch = alias(jobs, "import_batch");
	const types = importStageTypeSchema.options;
	// Follow parent IDs so legacy work with string-encoded payloads is counted too.
	const stages = await db
		.select({
			type: jobs.type,
			total: count(),
			processed: sql<number>`count(*) FILTER (WHERE ${jobs.status} = 'completed')::int`,
			failed: sql<number>`count(*) FILTER (WHERE ${jobs.status} = 'failed')::int`,
			cancelled: sql<number>`count(*) FILTER (WHERE ${jobs.status} = 'cancelled')::int`,
			pending: sql<number>`count(*) FILTER (WHERE ${jobs.status} = 'pending')::int`,
			running: sql<number>`count(*) FILTER (WHERE ${jobs.status} = 'in_progress')::int`,
		})
		.from(jobs)
		.innerJoin(
			target,
			and(eq(jobs.parentId, target.id), eq(target.type, "import_batch_target")),
		)
		.innerJoin(
			batch,
			and(eq(target.parentId, batch.id), eq(batch.type, "import_batch_parent")),
		)
		.where(and(eq(batch.id, id), inArray(jobs.type, types)))
		.groupBy(jobs.type);
	return types.flatMap((type) => stages.filter((stage) => stage.type === type));
}

/** Projects only safe labels and IDs. Legacy CCIP chunks expand to one row per medium. */
export async function listBatchTargets(input: {
	id: string;
	offset: number;
	limit: number;
}) {
	const payload = sql`(CASE WHEN jsonb_typeof(${jobs.payload})='string' AND pg_input_is_valid(${jobs.payload}#>>'{}','jsonb') THEN (${jobs.payload}#>>'{}')::jsonb ELSE ${jobs.payload} END)`;
	const expanded = db
		.select({
			childId: jobs.id,
			type: jobs.type,
			mediaId: sql<
				string | null
			>`CASE WHEN pg_input_is_valid(ids.media_id,'uuid') THEN ids.media_id::uuid END`.as(
				"target_id",
			),
			label: sql<
				string | null
			>`CASE WHEN ${jobs.type}='import_batch_target' THEN ${payload}->>'label' END`.as(
				"target_label",
			),
			skipped:
				sql<boolean>`coalesce(${payload}->>'skipped','false') = 'true'`.as(
					"skipped",
				),
			status: sql<
				typeof jobs.$inferSelect.status | null
			>`CASE WHEN ${jobs.status}='failed' AND jsonb_typeof(${payload}->'mediaIds')='array' THEN NULL ELSE ${jobs.status} END`.as(
				"target_status",
			),
		})
		.from(jobs)
		.leftJoin(
			sql`LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(${payload}->'mediaIds')='array' THEN ${payload}->'mediaIds'
			ELSE jsonb_build_array(${payload}->>'mediaId') END) ids(media_id)`,
			sql`true`,
		)
		.where(
			and(
				eq(jobs.parentId, input.id),
				sql`(${jobs.type} = 'import_batch_target' OR ids.media_id IS NOT NULL)`,
			),
		)
		.as("target");
	// Paginate before looking up current work and media details.
	const page = db
		.select()
		.from(expanded)
		.orderBy(asc(expanded.childId), asc(expanded.mediaId))
		.limit(input.limit)
		.offset(input.offset)
		.as("page");
	const ranks = importAiStages.flatMap((types, rank) =>
		types.map((type) => sql`WHEN ${type} THEN ${rank + 1}::int`),
	);
	const [items, counts, stages] = await Promise.all([
		db
			.select({
				mediaId: page.mediaId,
				mediaSourceId: medias.mediaSourceId,
				mediaModifiedAt: medias.modifiedAt,
				label: sql<string>`coalesce(${medias.fileName},${page.label},${page.mediaId}::text,'')`,
				status: sql<JobStatus | null>`coalesce(step.status,${page.status})`,
				skipped: page.skipped,
				uploadReservationId: sql<
					string | null
				>`CASE WHEN step.type='import_upload' AND ((step.status='failed' AND EXISTS (SELECT 1 FROM jobs root WHERE root.id=${input.id}::uuid AND root.status IN ('failed','cancelled'))) OR (step.status='pending' AND step.payload->>'awaitingFile'='true')) THEN step.id END`,
				stage: sql<
					string | null
				>`CASE WHEN ${page.type}='import_batch_target' THEN step.type ELSE ${page.type} END`,
			})
			.from(page)
			.leftJoin(medias, sql`${medias.id}=${page.mediaId}`)
			.leftJoin(
				sql`LATERAL (
			SELECT w.id,w.type,w.status,w.payload FROM jobs w WHERE w.parent_id=${page.childId}
			AND ${page.type}='import_batch_target' AND (w.status IN ('pending','in_progress') OR (w.status='failed' AND ${page.status}='failed'))
			ORDER BY (w.status='in_progress') DESC, CASE w.type ${sql.join(ranks, sql` `)} ELSE 0 END,w.created_at,w.id LIMIT 1
		) step`,
				sql`true`,
			)
			.orderBy(asc(page.childId), asc(page.mediaId)),
		db.select({ total: sql<number>`count(*)::int` }).from(expanded),
		listImportStages(input.id),
	]);
	return batchTargetsSchema.parse({
		items,
		total: counts[0]?.total ?? 0,
		...(stages.length > 0 && { stages }),
	});
}
