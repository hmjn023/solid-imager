import { implement, ORPCError } from "@orpc/server";
import { downloadsContract } from "@solid-imager/core/domain/contract/downloads.contract";
import { queueDownloadJobs } from "~/infrastructure/jobs/download-jobs";
import { downloadRunService } from "~/infrastructure/services/download-run-service";
import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import { z } from "zod";
import { logger } from "~/infrastructure/logger";
import { restoreJobHistory } from "~/infrastructure/repositories/job-history-repository";

async function respond<T>(action: () => Promise<T>): Promise<T> {
	try {
		return await action();
	} catch (error) {
		if (error instanceof ResourceNotFoundError)
			throw new ORPCError("NOT_FOUND", { message: "Download not found" });
		if (error instanceof ResourceConflictError)
			throw new ORPCError("CONFLICT", { message: error.message });
		if (error instanceof z.ZodError)
			throw new ORPCError("BAD_REQUEST", { message: "Invalid download input" });
		logger.error({ err: error }, "Download API operation failed");
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Unable to access downloads",
		});
	}
}

/**
 * Downloads Router Implementation
 */
const os = implement(downloadsContract);

export const downloadsRouter = os.router({
	/**
	 * Starts bulk download jobs
	 */
	start: os.start.handler(({ input }) =>
		respond(async () => {
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
				runIds: result.runIds,
			};
		}),
	),
	list: os.list.handler(({ input }) =>
		respond(() => downloadRunService.list(input)),
	),
	get: os.get.handler(({ input }) =>
		respond(() => downloadRunService.get(input.id)),
	),
	retry: os.retry.handler(({ input }) =>
		respond(async () => {
			const run = await downloadRunService.retry(input.id);
			await restoreJobHistory({ id: run.id, parentId: null });
			return run;
		}),
	),
	cancel: os.cancel.handler(({ input }) =>
		respond(() => downloadRunService.cancel(input.id)),
	),
});
