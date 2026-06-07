import { os } from "@orpc/server";
import { bulkDownloadRequestSchema } from "@solid-imager/core/domain/media/schemas";
import { queueDownloadJobs } from "~/infrastructure/jobs/download-jobs";

/**
 * Downloads Router Implementation
 */
export const downloadsRouter = {
	/**
	 * Starts bulk download jobs
	 */
	start: os.input(bulkDownloadRequestSchema).handler(async ({ input }) => {
		const result = await queueDownloadJobs(
			input.mediaSourceId,
			input.items,
		);
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
};
