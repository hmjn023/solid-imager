import type { JobRecord, JobRepositoryPort } from "../ports/job-repository";
import type { JobEventPublisher } from "./runtime-events";

export type TaggingJobTarget = {
	id: string;
	mediaSourceId: string;
};

export type AutoTaggingRunnerDeps = {
	jobRepository: Pick<JobRepositoryPort, "incrementProgress" | "findById" | "update">;
	executeAutoTagging(input: {
		mediaId: string;
		mediaSourceId: string;
		force?: boolean;
	}): Promise<void>;
	jobEvents: JobEventPublisher;
	logger?: {
		error?(data: unknown, message?: string): void;
	};
};

export type BulkTaggingDispatchRunnerDeps = {
	jobRepository: Pick<JobRepositoryPort, "createMany">;
	scanTargets(input: {
		force?: boolean;
		batchSize?: number;
		mediaSourceId?: string;
	}): AsyncGenerator<TaggingJobTarget>;
	logger?: {
		info?(data: unknown, message?: string): void;
	};
};

function getAutoTaggingPayload(payload: unknown): {
	mediaId: string;
	force?: boolean;
} {
	if (
		typeof payload === "object" &&
		payload !== null &&
		"mediaId" in payload &&
		typeof payload.mediaId === "string"
	) {
		return {
			mediaId: payload.mediaId,
			force: "force" in payload && typeof payload.force === "boolean" ? payload.force : undefined,
		};
	}

	throw new Error("Invalid auto_tagging job payload");
}

function getParentJobPayload(payload: unknown): {
	total: number;
	processed: number;
} | null {
	if (
		typeof payload === "object" &&
		payload !== null &&
		"total" in payload &&
		typeof payload.total === "number" &&
		"processed" in payload &&
		typeof payload.processed === "number"
	) {
		return {
			total: payload.total,
			processed: payload.processed,
		};
	}

	return null;
}

function getBulkTaggingDispatchPayload(payload: unknown): {
	force?: boolean;
	batchSize?: number;
	mediaSourceId?: string;
} {
	if (typeof payload !== "object" || payload === null) {
		return {};
	}

	return {
		force: "force" in payload && typeof payload.force === "boolean" ? payload.force : undefined,
		batchSize:
			"batchSize" in payload && typeof payload.batchSize === "number"
				? payload.batchSize
				: undefined,
		mediaSourceId:
			"mediaSourceId" in payload && typeof payload.mediaSourceId === "string"
				? payload.mediaSourceId
				: undefined,
	};
}

export async function runAutoTaggingJob(
	job: JobRecord,
	deps: AutoTaggingRunnerDeps,
): Promise<void> {
	if (!job.mediaSourceId) {
		throw new Error("Missing mediaSourceId");
	}

	const payload = getAutoTaggingPayload(job.payload);
	try {
		await deps.executeAutoTagging({
			mediaId: payload.mediaId,
			mediaSourceId: job.mediaSourceId,
			force: payload.force,
		});

		if (!job.parentId) {
			return;
		}

		await deps.jobRepository.incrementProgress(job.parentId);
		const parentJob = await deps.jobRepository.findById(job.parentId);
		if (!parentJob) {
			return;
		}

		const parentPayload = getParentJobPayload(parentJob.payload);
		if (!parentPayload) {
			deps.logger?.error?.(
				{ parentId: job.parentId, payload: parentJob.payload },
				"Invalid parent job payload",
			);
			return;
		}

		await deps.jobEvents.jobProgress({
			jobId: job.parentId,
			processed: parentPayload.processed,
			total: parentPayload.total,
		});

		if (parentPayload.processed >= parentPayload.total) {
			await deps.jobRepository.update(job.parentId, { status: "completed" });
			await deps.jobEvents.jobCompleted({
				jobId: job.parentId,
				message: "Batch tagging completed.",
			});
			if (parentJob.mediaSourceId && deps.jobEvents.allJobsCompleted) {
				await deps.jobEvents.allJobsCompleted({
					mediaSourceId: parentJob.mediaSourceId,
					processed: parentPayload.total,
				});
			}
		}
	} catch (error) {
		if (job.parentId) {
			await deps.jobRepository.update(job.parentId, { status: "failed" });
			await deps.jobEvents.jobFailed({
				jobId: job.parentId,
				error: error instanceof Error ? error.message : String(error),
			});
		}
		throw error;
	}
}

export async function runBulkTaggingDispatchJob(
	job: JobRecord,
	deps: BulkTaggingDispatchRunnerDeps,
): Promise<void> {
	const payload = getBulkTaggingDispatchPayload(job.payload);
	const batch: TaggingJobTarget[] = [];
	let totalCount = 0;

	for await (const target of deps.scanTargets(payload)) {
		batch.push(target);
		if (batch.length >= 500) {
			await deps.jobRepository.createMany(
				batch.map((t) => ({
					type: "auto_tagging",
					mediaSourceId: t.mediaSourceId,
					payload: {
						mediaId: t.id,
						mediaSourceId: t.mediaSourceId,
						force: payload.force,
					},
				})),
			);
			totalCount += batch.length;
			batch.length = 0;
		}
	}

	if (batch.length > 0) {
		await deps.jobRepository.createMany(
			batch.map((t) => ({
				type: "auto_tagging",
				mediaSourceId: t.mediaSourceId,
				payload: {
					mediaId: t.id,
					mediaSourceId: t.mediaSourceId,
					force: payload.force,
				},
			})),
		);
		totalCount += batch.length;
	}

	deps.logger?.info?.(
		{
			jobId: job.id,
			processedCount: totalCount,
			mediaSourceId: payload.mediaSourceId,
		},
		"Bulk tagging dispatch completed",
	);
}

export function createJobEventPublisher(
	publish: (event: string, payload: unknown) => Promise<void> | void,
): JobEventPublisher {
	return {
		jobProgress: (event) => publish("job-progress", event),
		jobCompleted: (event) => publish("job-completed", event),
		jobFailed: (event) => publish("job-failed", event),
		allJobsCompleted: (event) => publish("all-jobs-completed", event),
	};
}
