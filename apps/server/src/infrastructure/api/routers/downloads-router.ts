import { implement } from "@orpc/server";
import { downloadsContract } from "@solid-imager/core/domain/contract/downloads.contract";
import { queueDownloadJobs } from "~/infrastructure/jobs/download-jobs";

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
		const msg =
			result.skippedCount > 0
				? `Queued ${result.jobCount} download jobs (${result.skippedCount} duplicates skipped)`
				: `Queued ${result.jobCount} download jobs`;
		return {
			success: true,
			jobCount: result.jobCount,
			skippedCount: result.skippedCount,
			message: msg,
		};
	}),
});
