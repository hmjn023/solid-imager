import { ORPCError } from "@orpc/server";
import {
	jobDtoSchema,
	type JobDto,
} from "@solid-imager/core/domain/jobs/schemas";
import {
	safeSourceRunSchema,
	type SourceRun,
} from "@solid-imager/core/domain/source-runs/schemas";
import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import { SourceRunRepository } from "~/infrastructure/repositories/source-run-repository";
import { sourceRunService } from "~/infrastructure/services/source-run-service";
import { restoreJobHistory } from "~/infrastructure/repositories/job-history-repository";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";

export function toSafeSourceRun(run: SourceRun) {
	const { path: _path, ...artifact } = run.artifact ?? { path: "" };
	const { offset: _offset, fileCursor: _cursor, ...progress } = run.checkpoint;
	const recoverable =
		!!run.input &&
		!!run.sourceId &&
		["failed", "cancelled"].includes(run.status) &&
		(!run.retentionExpiresAt || run.retentionExpiresAt > new Date());
	return safeSourceRunSchema.parse({
		id: run.id,
		sourceId: run.sourceId,
		kind: run.kind,
		status: run.status,
		attemptCount: run.attemptCount,
		createdAt: run.createdAt,
		updatedAt: run.updatedAt,
		finishedAt: run.finishedAt,
		progress,
		artifact: run.artifact ? artifact : null,
		failureCode:
			run.failureCode === "input_expired"
				? "input_expired"
				: run.failureCode === "source_changed"
					? "source_changed"
					: run.status === "blocked"
						? "legacy_blocked"
						: run.failureCode
							? "source_failed"
							: null,
		canRetry: recoverable,
		canCancel: ["pending", "in_progress", "failed", "blocked"].includes(
			run.status,
		),
	});
}

export function toSourceJobDto(run: SourceRun): JobDto {
	const safe = toSafeSourceRun(run);
	return jobDtoSchema.parse({
		id: run.id,
		type: run.kind === "sync" ? "source_sync" : "source_" + run.kind,
		mediaSourceId: run.sourceId,
		status: run.status === "blocked" ? "failed" : run.status,
		createdAt: run.createdAt,
		updatedAt: run.updatedAt,
		startedAt: run.startedAt,
		finishedAt: run.finishedAt,
		parentId: null,
		error: safe.failureCode ? "Source operation failed" : null,
		cancelRequestedAt: run.cancelRequestedAt,
		cancelledAt: run.status === "cancelled" ? run.finishedAt : null,
		attemptCount: run.attemptCount,
		targetMediaId: null,
		targetMediaModifiedAt: null,
		progress: null,
		processingSteps: [],
		currentProcessingSteps: [],
		artifact:
			run.status === "completed" &&
			run.artifact &&
			run.artifact.expiresAt > new Date()
				? {
						fileName: run.artifact.fileName,
						contentType: run.artifact.contentType,
						size: run.artifact.size,
					}
				: null,
		canRetry: safe.canRetry,
		canCancel: safe.canCancel,
		canDelete: !["pending", "in_progress"].includes(run.status),
	});
}

export async function findSourceJob(id: string) {
	await sourceRunService.initialize();
	const run = await SourceRunRepository.findById(id);
	return run ? toSourceJobDto(run) : null;
}

export async function mutateSourceRun(action: "retry" | "cancel", id: string) {
	await sourceRunService.initialize();
	try {
		const run = await (action === "retry"
			? sourceRunService.retry(id)
			: SourceRunRepository.cancel(id));
		if (action === "retry")
			await restoreJobHistory({ id: run.id, parentId: null });
		if (action === "cancel")
			RealtimeEventBus.publishJob("job-cancelled", {
				jobId: id,
				message: "Source operation cancelled",
			});
		if (action === "cancel" && run.kind === "sync")
			sourceRunService.notify(run);
		return run;
	} catch (error) {
		if (error instanceof ResourceConflictError)
			throw new ORPCError("BAD_REQUEST", { message: error.message });
		if (error instanceof ResourceNotFoundError)
			throw new ORPCError("NOT_FOUND", {
				message: "Source operation not found",
			});
		throw error;
	}
}
