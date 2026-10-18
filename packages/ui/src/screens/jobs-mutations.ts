import type { JobBulkAction } from "./jobs-selection";

export type JobMutationApi = Record<
	JobBulkAction,
	(input: { id: string }) => Promise<unknown>
>;

/** Keep DB-heavy batch cancellation sequential; retain partial successes on errors. */
export async function mutateSelectedJobs(
	api: JobMutationApi,
	action: JobBulkAction,
	ids: readonly string[],
) {
	const failed: string[] = [];
	let succeeded = 0;
	for (const id of new Set(ids)) {
		try {
			await api[action]({ id });
			succeeded++;
		} catch {
			failed.push(id);
		}
	}
	return { succeeded, failed };
}
