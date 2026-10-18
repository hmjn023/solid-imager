import { sql } from "drizzle-orm";
import { z } from "zod";
import {
	jobRetryFailedCursorSchema,
	type JobRetryFailedRequest,
} from "@solid-imager/core/domain/jobs/schemas";
import { isRecord } from "@solid-imager/core/utils/type-guards";
import { getExecutor } from "~/infrastructure/db/executor";

const candidateSchema = z.object({
	id: z.uuid(),
	kind: z.enum(["batch", "download", "source"]),
});
export const FAILED_RETRY_PAGE_SIZE = 5;
function rows(result: unknown): unknown[] {
	if (Array.isArray(result)) return result;
	return isRecord(result) && Array.isArray(result.rows) ? result.rows : [];
}

/** One row per execution owner, never one row per failed media item. */
export async function findFailedRetryCandidates(input: JobRetryFailedRequest) {
	const db = getExecutor();
	const before =
		input.cursor?.before ??
		z
			.object({ before: jobRetryFailedCursorSchema.shape.before })
			.parse(
				rows(
					await db.execute(
						sql`SELECT to_char(localtimestamp, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS before`,
					),
				)[0],
			).before;
	const cutoff = sql`${before}::timestamp`;
	const result = await db.execute(sql`
		WITH candidates AS (
			SELECT id, created_at, 'download' AS kind FROM download_runs
			 WHERE status = 'failed' AND input IS NOT NULL AND source_id IS NOT NULL
			UNION ALL
			SELECT id, created_at, 'source' AS kind FROM source_sync_runs
			 WHERE status = 'failed' AND input IS NOT NULL AND source_id IS NOT NULL
			 AND (retention_expires_at IS NULL OR retention_expires_at > timezone('UTC', clock_timestamp()))
			UNION ALL
			SELECT id, created_at, 'source' AS kind FROM source_transfer_runs
			 WHERE status = 'failed' AND input IS NOT NULL AND source_id IS NOT NULL
			 AND (retention_expires_at IS NULL OR retention_expires_at > timezone('UTC', clock_timestamp()))
			UNION ALL
			SELECT r.id, r.created_at, 'batch' AS kind FROM batch_runs r
			 WHERE r.input IS NOT NULL AND r.status IN ('failed', 'pending', 'in_progress')
			 AND EXISTS (SELECT 1 FROM batch_items i WHERE i.run_id = r.id AND (
			   i.status IN ('failed', 'superseded') OR (r.status = 'failed' AND i.status IN ('pending', 'scheduled'))
			 ))
		)
		SELECT id, kind FROM candidates WHERE created_at <= ${cutoff}
		 AND NOT EXISTS (SELECT 1 FROM job_history_dismissals h WHERE h.id = candidates.id)
		 ${input.cursor ? sql`AND id > ${input.cursor.afterId}::uuid` : sql``}
		 ORDER BY id LIMIT ${FAILED_RETRY_PAGE_SIZE + 1}
	`);
	const candidates = z.array(candidateSchema).parse(rows(result));
	return {
		before,
		candidates: candidates.slice(0, FAILED_RETRY_PAGE_SIZE),
		hasMore: candidates.length > FAILED_RETRY_PAGE_SIZE,
	};
}
