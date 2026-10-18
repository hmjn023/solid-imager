import {
	isBatchParentJobType,
	type JobDto,
} from "@solid-imager/core/domain/jobs/schemas";

export type JobBulkAction = "retry" | "cancel" | "delete";
export function getJobActionTargetId(
	job: Pick<JobDto, "id" | "parentId" | "type">,
	action: JobBulkAction,
): string {
	return action !== "retry" &&
		job.parentId &&
		[
			"auto_tagging",
			"extract_ccip_vector",
			"generate_thumbnail",
			"processMedia",
		].includes(job.type)
		? job.parentId
		: job.id;
}
type JobActionCandidate = Pick<
	JobDto,
	"id" | "status" | "type" | "canRetry" | "canCancel" | "canDelete"
>;
export function canApplyJobAction(
	job: JobActionCandidate,
	action: JobBulkAction,
): boolean {
	if (action === "retry") return job.canRetry ?? job.status === "failed";
	if (action === "cancel")
		return (
			job.canCancel ??
			(["pending", "in_progress"].includes(job.status) &&
				!isBatchParentJobType(job.type))
		);
	return (
		job.canDelete ?? ["completed", "failed", "cancelled"].includes(job.status)
	);
}
export function getJobActionIds(
	jobs: readonly JobActionCandidate[],
	action?: JobBulkAction,
): string[] {
	return jobs
		.filter((job) =>
			action
				? canApplyJobAction(job, action)
				: (["retry", "cancel", "delete"] as const).some((candidate) =>
						canApplyJobAction(job, candidate),
					),
		)
		.map((job) => job.id);
}

type JobSelectionCandidate = Pick<JobDto, "id" | "status" | "canRetry">;

export function getRetryableJobIds(
	jobs: readonly JobSelectionCandidate[],
): string[] {
	return jobs
		.filter((job) => job.canRetry ?? job.status === "failed")
		.map((job) => job.id);
}

export function toggleJobSelection(
	selectedJobIds: ReadonlySet<string>,
	jobId: string,
): Set<string> {
	const nextSelectedJobIds = new Set(selectedJobIds);
	if (nextSelectedJobIds.has(jobId)) {
		nextSelectedJobIds.delete(jobId);
	} else {
		nextSelectedJobIds.add(jobId);
	}
	return nextSelectedJobIds;
}

export function toggleAllJobSelection(
	selectedJobIds: ReadonlySet<string>,
	retryableJobIds: readonly string[],
): Set<string> {
	const allRetryableJobsSelected =
		retryableJobIds.length > 0 &&
		retryableJobIds.every((jobId) => selectedJobIds.has(jobId));

	if (allRetryableJobsSelected) {
		const retryableJobIdSet = new Set(retryableJobIds);
		return new Set(
			[...selectedJobIds].filter((jobId) => !retryableJobIdSet.has(jobId)),
		);
	}

	return new Set([...selectedJobIds, ...retryableJobIds]);
}
