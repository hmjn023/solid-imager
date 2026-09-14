import type { JobDto } from "@solid-imager/core/domain/jobs/schemas";

type JobSelectionCandidate = Pick<JobDto, "id" | "status">;

export function getRetryableJobIds(
	jobs: readonly JobSelectionCandidate[],
): string[] {
	return jobs.filter((job) => job.status === "failed").map((job) => job.id);
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
