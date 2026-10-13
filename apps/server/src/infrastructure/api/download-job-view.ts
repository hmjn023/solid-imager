import { z } from "zod";
import { inArray, sql } from "drizzle-orm";
import {
	jobDtoSchema,
	type JobDto,
	type JobListRequest,
} from "@solid-imager/core/domain/jobs/schemas";
import type { Job } from "@solid-imager/core/domain/repositories/job-repository";
import type { DownloadRun } from "@solid-imager/core/domain/downloads/schemas";
import { isRecord } from "@solid-imager/core/utils/type-guards";
import { jobs } from "~/infrastructure/db/schema";
import { getExecutor } from "~/infrastructure/db/executor";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { DownloadRunRepository } from "~/infrastructure/repositories/download-run-repository";
import { downloadRunService } from "~/infrastructure/services/download-run-service";
import { findCurrentProcessingSteps } from "./media-processing-status";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { ORPCError } from "@orpc/server";
import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";

export function toDownloadJobDto(run: DownloadRun): JobDto {
	const ids =
		run.result?.mediaIds ??
		run.checkpoint?.entries.flatMap((entry) =>
			entry.mediaId ? [entry.mediaId] : [],
		) ??
		[];
	const total = run.checkpoint?.entries.length ?? 1;
	const processed =
		run.status === "completed"
			? total
			: (run.checkpoint?.entries.filter((entry) => entry.published).length ??
				0);
	return jobDtoSchema.parse({
		id: run.id,
		type: "downloadImage",
		mediaSourceId: run.mediaSourceId,
		status:
			run.status === "blocked"
				? "failed"
				: run.status === "superseded"
					? "cancelled"
					: run.status,
		createdAt: run.createdAt,
		updatedAt: run.updatedAt,
		parentId: run.canonicalId ?? run.parentId,
		error: run.error || run.blockedReason ? "Download failed" : null,
		cancelRequestedAt: run.cancelRequestedAt,
		cancelledAt: run.cancelledAt,
		attemptCount: run.attemptCount,
		startedAt: run.startedAt,
		finishedAt: run.finishedAt,
		targetMediaId: ids[0] ?? null,
		targetMediaModifiedAt: null,
		progress: {
			processed,
			failed:
				["failed", "blocked"].includes(run.status) && processed < total ? 1 : 0,
			total,
		},
		processingSteps: [],
		currentProcessingSteps: [],
		artifact: null,
	});
}
export async function findDownloadJob(id: string): Promise<JobDto | null> {
	await downloadRunService.initialize();
	const run = await DrizzleTransactionManager.transaction(async (tx) => {
		await DownloadRunRepository.assertDedicated(tx);
		return DownloadRunRepository.findById(id, tx);
	});
	if (!run) return null;
	const dto = toDownloadJobDto(run);
	if (dto.targetMediaId) {
		const media = await MediaRepository.findById(dto.targetMediaId);
		dto.targetMediaModifiedAt = media?.modifiedAt ?? null;
		dto.currentProcessingSteps =
			(await findCurrentProcessingSteps([dto.targetMediaId])).get(
				dto.targetMediaId,
			) ?? [];
	}
	return dto;
}
export async function mutateDownloadJob(
	action: "retry" | "cancel",
	id: string,
): Promise<JobDto> {
	try {
		if (action === "retry") await downloadRunService.retry(id);
		else await downloadRunService.cancel(id);
		const dto = await findDownloadJob(id);
		if (!dto)
			throw new ORPCError("NOT_FOUND", { message: "Download not found" });
		return dto;
	} catch (error) {
		if (error instanceof ResourceConflictError)
			throw new ORPCError("BAD_REQUEST", { message: error.message });
		if (error instanceof ResourceNotFoundError)
			throw new ORPCError("NOT_FOUND", { message: "Download not found" });
		throw error;
	}
}
const pageSchema = z.object({
	ids: z.array(z.object({ id: z.uuid() })),
	total: z.coerce.number().int().nonnegative(),
});
/** Temporary Jobs API compatibility projection. Dedicated execution never reads generic job rows. */
export async function listJobView(
	input: JobListRequest,
	projectJob: (job: Job) => JobDto,
) {
	await downloadRunService.initialize();
	return DrizzleTransactionManager.transaction(async (tx) => {
		await DownloadRunRepository.assertDedicated(tx);
		const db = getExecutor(tx);
		const genericStatus = input.status
			? sql`AND status = ${input.status}`
			: sql``;
		const runStatus = input.status
			? sql`AND (CASE WHEN status = 'blocked' THEN 'failed' ELSE status END) = ${input.status}`
			: sql``;
		const result: unknown = await db.execute(sql`
			WITH combined AS (
				SELECT id, created_at FROM jobs WHERE type <> 'downloadImage' ${genericStatus}
				UNION ALL
				SELECT id, created_at FROM download_runs WHERE status <> 'superseded' ${runStatus}
			), page AS (SELECT id, created_at FROM combined ORDER BY created_at DESC, id DESC LIMIT ${input.limit} OFFSET ${input.offset})
			SELECT coalesce(jsonb_agg(jsonb_build_object('id', id) ORDER BY created_at DESC, id DESC), '[]'::jsonb) AS ids, (SELECT count(*) FROM combined) AS total FROM page
		`);
		// Driver result is an external boundary; parse the shared pg/PGlite rows shape explicitly.
		const rows = Array.isArray(result)
			? result
			: isRecord(result) && Array.isArray(result.rows)
				? result.rows
				: [];
		const page = pageSchema.parse(rows[0]);
		const ids = page.ids.map((row) => row.id);
		const generic = ids.length
			? await db.select().from(jobs).where(inArray(jobs.id, ids))
			: [];
		const downloads = await DownloadRunRepository.findByIds(ids, tx);
		const items = new Map<string, JobDto>([
			...generic.map((row): [string, JobDto] => [row.id, projectJob(row)]),
			...downloads.map((row): [string, JobDto] => [
				row.id,
				toDownloadJobDto(row),
			]),
		]);
		return {
			items: ids.flatMap((id) => {
				const item = items.get(id);
				return item ? [item] : [];
			}),
			total: page.total,
		};
	});
}
