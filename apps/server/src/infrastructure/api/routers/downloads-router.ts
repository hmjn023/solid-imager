import { implement } from "@orpc/server";
import { downloadsContract } from "@solid-imager/core/contract";
import { queueDownloadJobs } from "~/infrastructure/jobs/download-jobs";
import { JobRepository } from "~/infrastructure/db/repositories";
import { notifyBatchState } from "~/infrastructure/events/batch-state";

/**
 * Downloads Router Implementation
 */
const os = implement(downloadsContract);

export const downloadsRouter = os.router({
	/**
	 * Starts bulk download jobs
	 */
	start: os.start.handler(async ({ input }) => {
		const result = await queueDownloadJobs(input.mediaSourceId, input.items);
		if (result.batchId)
			await notifyBatchState(JobRepository, result.batchId, { created: true });
		const msg =
			result.skippedCount > 0
				? `Queued ${result.jobCount} download jobs (${result.skippedCount} duplicates skipped)`
				: `Queued ${result.jobCount} download jobs`;
		return {
			success: true,
			jobCount: result.jobCount,
			batchId: result.batchId,
			skippedCount: result.skippedCount,
			message: msg,
		};
	}),
});
