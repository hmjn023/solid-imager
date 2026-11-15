import { importAiStages } from "@solid-imager/core/jobs";
import { asc, inArray, sql } from "drizzle-orm";
import { jobs } from "~/infrastructure/db/schema";

// Parent/dispatch records should appear beside the inference work they represent.
const INFERENCE_DISPLAY_ALIASES: Readonly<Record<string, readonly string[]>> = {
	auto_tagging: ["bulk_tagging_parent", "bulk_tagging_dispatch"],
	extract_embedding_batch: ["batch_embedding_parent"],
	extract_ccip_vector: ["batch_ccip_parent", "batch_ccip_dispatch"],
};

// These pools run concurrently. Do not imply download → thumbnail → metadata serial execution.
const PARALLEL_JOB_TYPES = [
	"downloadImage",
	"generate_thumbnail",
	"processMedia",
	"import_upload",
	"import_register",
	"import_batch_parent",
	"thumbnail_generation_parent",
	"source_export",
	"source_restore",
	"character_clustering",
];

/** A stable approximation of processing order, applied before pagination. */
export function jobListOrder() {
	const active = inArray(jobs.status, ["in_progress", "pending"]);
	const inferenceStages = importAiStages.map((types, index) => {
		const displayTypes = types.flatMap((type) => [
			type,
			...(INFERENCE_DISPLAY_ALIASES[type] ?? []),
		]);
		return sql`WHEN ${inArray(jobs.type, displayTypes)} THEN ${index + 1}::int`;
	});
	const stage = sql`CASE
		WHEN ${inArray(jobs.type, PARALLEL_JOB_TYPES)} THEN 0
		${sql.join(inferenceStages, sql` `)}
		ELSE ${importAiStages.length + 1}::int END`;

	return [
		sql`CASE ${jobs.status} WHEN 'in_progress' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END ASC`,
		sql`CASE WHEN ${active} THEN ${stage} ELSE 0 END ASC`,
		// The AI worker admits standalone jobs ahead of batch children within a stage.
		sql`CASE WHEN ${active} AND ${stage} BETWEEN 1 AND ${importAiStages.length}::int
			THEN (${jobs.parentId} IS NOT NULL)::int ELSE 0 END ASC`,
		// Heartbeats and progress must not move active rows within their group.
		sql`CASE WHEN ${active} THEN ${jobs.createdAt} END ASC`,
		sql`CASE WHEN NOT (${active}) THEN coalesce(${jobs.finishedAt}, ${jobs.cancelledAt}, ${jobs.updatedAt}, ${jobs.createdAt}) END DESC`,
		asc(jobs.id),
	];
}
