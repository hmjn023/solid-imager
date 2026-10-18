import { ORPCError } from "@orpc/server";
import {
	jobDtoSchema,
	type JobDto,
} from "@solid-imager/core/domain/jobs/schemas";
import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import type { BatchItem } from "@solid-imager/core/domain/batches/schemas";
import type { BatchSummary } from "@solid-imager/core/domain/repositories/batch-run-repository";
import { BatchRunRepository } from "~/infrastructure/repositories/batch-run-repository";
import { batchRunService } from "~/infrastructure/services/batch-run-service";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { findCurrentProcessingSteps } from "./media-processing-status";

export function toBatchJobDto(summary: BatchSummary, item?: BatchItem): JobDto {
	const { run, progress } = summary;
	const kind = item?.kind ?? run.input?.kind;
	const status = item
		? item.status === "scheduled"
			? "in_progress"
			: ["superseded", "blocked"].includes(item.status)
				? "failed"
				: item.status
		: run.status === "blocked"
			? "failed"
			: run.status;
	return jobDtoSchema.parse({
		id: item?.id ?? run.id,
		type: item
			? kind === "tagging"
				? "auto_tagging"
				: kind === "ccip"
					? "extract_ccip_vector"
					: kind === "thumbnail"
						? "generate_thumbnail"
						: kind === "metadata"
							? "extract_metadata"
							: "processMedia"
			: kind === "tagging"
				? "bulk_tagging_parent"
				: kind === "ccip"
					? "batch_ccip_parent"
					: kind === "thumbnail"
						? "thumbnail_generation_parent"
						: kind === "metadata"
							? "metadata_extraction_parent"
							: "processMedia",
		mediaSourceId: item?.mediaSourceId ?? run.input?.mediaSourceId ?? null,
		status,
		createdAt: item?.createdAt ?? run.createdAt,
		updatedAt: item?.updatedAt ?? run.updatedAt,
		parentId: item ? run.id : null,
		error: status === "failed" ? "Batch processing failed" : null,
		cancelRequestedAt: run.cancelRequestedAt,
		cancelledAt:
			status === "cancelled" ? (item?.finishedAt ?? run.finishedAt) : null,
		attemptCount: item?.attemptCount ?? run.attemptCount,
		startedAt: null,
		finishedAt: item?.finishedAt ?? run.finishedAt,
		targetMediaId:
			item?.mediaId ??
			(run.input?.mediaIds?.length === 1 ? run.input.mediaIds[0] : null),
		targetMediaModifiedAt: item?.input ? new Date(item.input.modifiedAt) : null,
		progress: item
			? null
			: {
					total: progress.total,
					processed: progress.completed + progress.cancelled,
					failed: progress.failed,
				},
		processingSteps: item
			? [
					{
						kind: item.kind,
						status: status === "cancelled" ? "skipped" : status,
						attemptCount: item.attemptCount,
						updatedAt: item.updatedAt.toISOString(),
					},
				]
			: [],
		currentProcessingSteps: [],
		artifact: null,
		canRetry: item
			? ["failed", "superseded"].includes(item.status) &&
				!!run.input &&
				!["blocked", "cancelled"].includes(run.status)
			: !!run.input && ["failed", "cancelled"].includes(run.status),
		canCancel:
			["pending", "in_progress"].includes(run.status) &&
			(!item || ["pending", "scheduled"].includes(item.status)),
		canDelete: !["pending", "in_progress"].includes(run.status),
	});
}
export async function findBatchJob(id: string): Promise<JobDto | null> {
	await batchRunService.initialize();
	const dto = await DrizzleTransactionManager.transaction(async (tx) => {
		await BatchRunRepository.assertDedicated(tx);
		const runId = await BatchRunRepository.resolveId(id, tx);
		if (!runId) return null;
		const summary = await BatchRunRepository.findById(runId, tx);
		return summary
			? toBatchJobDto(
					summary,
					(await BatchRunRepository.findItem(id, tx)) ?? undefined,
				)
			: null;
	});
	if (dto?.targetMediaId) {
		const media = await MediaRepository.findById(dto.targetMediaId);
		dto.targetMediaModifiedAt = media?.modifiedAt ?? null;
		dto.currentProcessingSteps =
			(await findCurrentProcessingSteps([dto.targetMediaId])).get(
				dto.targetMediaId,
			) ?? [];
	}
	return dto;
}
export async function mutateBatchJob(action: "retry" | "cancel", id: string) {
	try {
		const runId = await BatchRunRepository.resolveId(id);
		if (!runId) throw new ResourceNotFoundError("Batch", id);
		const item = await BatchRunRepository.findItem(id);
		if (!item && runId !== id)
			throw new ResourceConflictError(
				"Use the batch parent ID to change an archived dispatch or grouped child",
			);
		if (action === "retry" && item) {
			await BatchRunRepository.retryItem(id);
			await batchRunService.reconcile();
		} else if (action === "retry") await batchRunService.retry(runId);
		else {
			if (item && !["pending", "scheduled"].includes(item.status))
				throw new ResourceConflictError(
					"Use the batch parent to stop remaining items after this item has finished",
				);
			await batchRunService.cancel(runId);
		}
		const result = await findBatchJob(id);
		if (!result) throw new ResourceNotFoundError("Batch", id);
		return result;
	} catch (error) {
		if (error instanceof ResourceConflictError)
			throw new ORPCError("BAD_REQUEST", { message: error.message });
		if (error instanceof ResourceNotFoundError)
			throw new ORPCError("NOT_FOUND", { message: "Batch not found" });
		throw error;
	}
}
