import type {
	JobRetryFailedRequest,
	JobRetryFailedResponse,
} from "@solid-imager/core/domain/jobs/schemas";

export type RetryFailedTotals = Pick<
	JobRetryFailedResponse,
	"retried" | "skipped" | "failed"
>;
export async function retryAllFailedJobs(
	retryPage: (
		input: JobRetryFailedRequest,
		signal: AbortSignal,
	) => Promise<JobRetryFailedResponse>,
	signal: AbortSignal,
	onProgress: (totals: RetryFailedTotals) => void,
): Promise<RetryFailedTotals> {
	let cursor: JobRetryFailedRequest["cursor"];
	let totals: RetryFailedTotals = { retried: 0, skipped: 0, failed: 0 };
	for (;;) {
		signal.throwIfAborted();
		const page = await retryPage({ cursor }, signal);
		totals = {
			retried: totals.retried + page.retried,
			skipped: totals.skipped + page.skipped,
			failed: totals.failed + page.failed,
		};
		onProgress(totals);
		if (!page.cursor) return totals;
		if (
			cursor &&
			(page.cursor.before !== cursor.before ||
				page.cursor.afterId <= cursor.afterId)
		)
			throw new Error(
				"再試行の続き位置を取得できませんでした。もう一度お試しください。",
			);
		cursor = page.cursor;
	}
}
