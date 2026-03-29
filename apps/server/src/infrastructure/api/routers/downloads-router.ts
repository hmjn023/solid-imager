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
		const jobCount = await queueDownloadJobs(input.mediaSourceId, input.items);
		return {
			success: true,
			jobCount,
			message: `Queued ${jobCount} download jobs`,
		};
	}),
};
