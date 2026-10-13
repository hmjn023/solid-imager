import {
	findBatchJob,
	mutateBatchJob,
} from "~/infrastructure/api/batch-job-view";
import { findCurrentProcessingSteps } from "~/infrastructure/api/media-processing-status";
import type { JobDto } from "@solid-imager/core/domain/jobs/schemas";
import { implement, ORPCError } from "@orpc/server";
import { jobsContract } from "@solid-imager/core/domain/contract/jobs.contract";
import {
	mediaProcessingCheckpointSchema,
	processingStepKindSchema,
} from "@solid-imager/core/domain/jobs/schemas";
import {
	isBatchParentJobType,
	batchParentJobTypes,
	jobStatusSchema,
} from "@solid-imager/core/domain/jobs/schemas";
import type { Job } from "@solid-imager/core/domain/repositories/job-repository";
import type { JobEvent } from "@solid-imager/core/domain/sources/events";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { resolveJobArtifact } from "~/infrastructure/api/job-artifact";
import { db } from "~/infrastructure/db";
import { jobs } from "~/infrastructure/db/schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { JobRepository } from "~/infrastructure/repositories/job-repository";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import {
	findDownloadJob,
	listJobView,
	mutateDownloadJob,
} from "~/infrastructure/api/download-job-view";

const PublicJobFailureMessage = "Job failed";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonNegativeInteger(value: unknown): number | undefined {
	return typeof value === "number" && Number.isInteger(value) && value >= 0
		? value
		: undefined;
}

function readTargetMediaId(payload: unknown): string | null {
	if (!isRecord(payload)) {
		return null;
	}
	const result = z.uuid().safeParse(payload.mediaId);
	return result.success ? result.data : null;
}

function readProgress(payload: unknown) {
	if (!isRecord(payload)) {
		return null;
	}
	const processed = readNonNegativeInteger(payload.processed);
	const total = readNonNegativeInteger(payload.total);
	if (processed === undefined || total === undefined) {
		return null;
	}
	return {
		processed,
		failed: readNonNegativeInteger(payload.failed) ?? 0,
		total,
	};
}

async function findTargetMediaModifiedAt(
	job: Pick<Job, "payload">,
): Promise<Date | null> {
	const targetMediaId = readTargetMediaId(job.payload);
	if (!targetMediaId) return null;

	const media = await MediaRepository.findById(targetMediaId);
	return media?.modifiedAt ?? null;
}

export function toJobDto(
	job: Job,
	targetMediaModifiedAt: Date | null = null,
	currentProcessingSteps: JobDto["currentProcessingSteps"] = [],
) {
	const checkpoint = mediaProcessingCheckpointSchema.safeParse(
		job.processingCheckpoint,
	);
	return {
		id: job.id,
		type: job.type,
		mediaSourceId: job.mediaSourceId,
		status: jobStatusSchema.parse(job.status),
		createdAt: job.createdAt,
		updatedAt: job.updatedAt,
		parentId: job.parentId,
		error: job.error === null ? null : PublicJobFailureMessage,
		cancelRequestedAt: job.cancelRequestedAt ?? null,
		cancelledAt: job.cancelledAt ?? null,
		attemptCount: job.attemptCount ?? 0,
		startedAt: job.startedAt ?? null,
		finishedAt: job.finishedAt ?? null,
		targetMediaId: readTargetMediaId(job.payload),
		targetMediaModifiedAt,
		progress: readProgress(job.payload),
		currentProcessingSteps,
		processingSteps:
			job.type === "processMedia" && checkpoint.success
				? processingStepKindSchema.options.map((kind) => {
						const step = checkpoint.data.steps[kind];
						return {
							kind,
							...step,
							status:
								step.status === "in_progress" && job.status !== "in_progress"
									? ("pending" as const)
									: step.status,
						};
					})
				: [],
		artifact:
			job.status === "completed" &&
			job.artifactPath &&
			job.artifactFileName &&
			job.artifactContentType
				? {
						fileName: job.artifactFileName,
						contentType: job.artifactContentType,
						size: job.artifactSize ?? null,
					}
				: null,
	};
}

async function currentJobDto(job: Job) {
	const id = readTargetMediaId(job.payload);
	const steps = await findCurrentProcessingSteps(id ? [id] : []);
	return toJobDto(
		job,
		await findTargetMediaModifiedAt(job),
		id ? steps.get(id) : [],
	);
}

const os = implement(jobsContract);

export const jobsRouter = os.router({
	list: os.list.handler(async ({ input }) => {
		const page = await listJobView(input, toJobDto);
		const ids = [
			...new Set(
				page.items.flatMap((job) =>
					job.targetMediaId ? [job.targetMediaId] : [],
				),
			),
		];
		const media = await MediaRepository.findByIds(ids);
		const modified = new Map(media.map((item) => [item.id, item.modifiedAt]));
		const currentSteps = await findCurrentProcessingSteps(ids);
		return {
			items: page.items.map((job) => ({
				...job,
				targetMediaModifiedAt: modified.get(job.targetMediaId ?? "") ?? null,
				currentProcessingSteps: currentSteps.get(job.targetMediaId ?? "") ?? [],
			})),
			total: page.total,
		};
	}),

	get: os.get.handler(async ({ input }) => {
		const download = await findDownloadJob(input.id);
		if (download) return download;
		const batch = await findBatchJob(input.id);
		if (batch) return batch;
		const [job] = await db.select().from(jobs).where(eq(jobs.id, input.id));
		if (!job) {
			throw new ORPCError("NOT_FOUND", { message: "Job not found" });
		}
		return currentJobDto(job);
	}),

	downloadArtifact: os.downloadArtifact.handler(async ({ input }) => {
		const artifact = await resolveJobArtifact(input.id);
		if (!artifact) {
			throw new ORPCError("NOT_FOUND", {
				message: "Artifact not found",
			});
		}

		return artifact.stream;
	}),

	retry: os.retry.handler(async ({ input }) => {
		const download = await findDownloadJob(input.id);
		if (download) return mutateDownloadJob("retry", input.id);
		const batch = await findBatchJob(input.id);
		if (batch) return mutateBatchJob("retry", input.id);
		const [requeued] = await db
			.update(jobs)
			.set({
				// Explicit user retry, distinct from a crashed observer's stale recovery.
				payload: sql`CASE WHEN ${jobs.type} IN ('processMedia', 'generate_thumbnail') THEN jsonb_set(coalesce(${jobs.payload}, '{}'::jsonb), '{retryFileTasks}', 'true'::jsonb) WHEN ${jobs.type} IN ('auto_tagging', 'extract_ccip_vector') THEN jsonb_set(coalesce(${jobs.payload}, '{}'::jsonb), '{retryAiTasks}', 'true'::jsonb) ELSE ${jobs.payload} END`,
				status: "pending",
				error: null,
				result: null,
				cancelRequestedAt: null,
				cancelledAt: null,
				startedAt: null,
				finishedAt: null,
				artifactPath: null,
				artifactFileName: null,
				artifactContentType: null,
				artifactSize: null,
				artifactExpiresAt: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(jobs.id, input.id),
					eq(jobs.status, "failed"),
					notInArray(jobs.type, ["import_request", ...batchParentJobTypes]),
				),
			)
			.returning();
		if (!requeued) {
			const [current] = await db
				.select({ id: jobs.id, type: jobs.type })
				.from(jobs)
				.where(eq(jobs.id, input.id));
			if (!current) {
				throw new ORPCError("NOT_FOUND", { message: "Job not found" });
			}
			if (
				isBatchParentJobType(current.type) ||
				current.type === "import_request"
			) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"This job is not executable. Retry failed processing steps or dispatch jobs instead.",
				});
			}
			throw new ORPCError("BAD_REQUEST", {
				message: "Only failed jobs can be retried",
			});
		}
		RealtimeEventBus.publishJob("job-retried", {
			jobId: requeued.id,
			message: "Job queued for retry",
		});
		return currentJobDto(requeued);
	}),

	cancel: os.cancel.handler(async ({ input }) => {
		const download = await findDownloadJob(input.id);
		if (download) return mutateDownloadJob("cancel", input.id);
		const batch = await findBatchJob(input.id);
		if (batch) return mutateBatchJob("cancel", input.id);
		const job = await JobRepository.findById(input.id);
		if (!job) {
			throw new ORPCError("NOT_FOUND", { message: "Job not found" });
		}
		if (job.status !== "pending" && job.status !== "in_progress") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Only pending or in-progress jobs can be cancelled",
			});
		}
		if (isBatchParentJobType(job.type)) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Batch parent jobs cannot be cancelled",
			});
		}

		await JobRepository.requestCancellation(input.id);
		const cancelled = await JobRepository.findById(input.id);
		if (!cancelled) {
			throw new ORPCError("NOT_FOUND", { message: "Job not found" });
		}
		RealtimeEventBus.publishJob("job-cancelled", {
			jobId: input.id,
			message:
				cancelled.status === "in_progress"
					? "Cancellation requested"
					: "Job cancelled",
		});
		return currentJobDto(cancelled);
	}),

	events: os.events.handler(async function* ({ signal }) {
		const queue: JobEvent[] = [];
		let resolve: (() => void) | null = null;

		const unsubscribe = RealtimeEventBus.subscribeToJobs((event) => {
			queue.push(event);
			resolve?.();
			resolve = null;
		});

		try {
			while (!signal?.aborted) {
				if (queue.length === 0) {
					if (signal?.aborted) {
						break;
					}
					await new Promise<void>((done) => {
						if (signal?.aborted) {
							done();
							return;
						}
						const onAbort = () => {
							done();
						};
						signal?.addEventListener("abort", onAbort, { once: true });
						resolve = () => {
							signal?.removeEventListener("abort", onAbort);
							done();
						};
					});
				}

				while (queue.length > 0) {
					const event = queue.shift();
					if (event) {
						yield event;
					}
				}
			}
		} finally {
			unsubscribe();
		}
	}),
});
