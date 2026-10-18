import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import type {
	JobRetryFailedRequest,
	JobRetryFailedResponse,
} from "@solid-imager/core/domain/jobs/schemas";
import { findFailedRetryCandidates } from "~/infrastructure/repositories/failed-job-retry-repository";
import { logger } from "~/infrastructure/logger";
import { batchRunService } from "./batch-run-service";
import { downloadRunService } from "./download-run-service";
import { sourceRunService } from "./source-run-service";

/** Bounded continuation keeps a large retry outside one HTTP request/transaction. */
export async function retryFailedJobsPage(
	input: JobRetryFailedRequest,
): Promise<JobRetryFailedResponse> {
	await downloadRunService.initialize();
	await batchRunService.initialize();
	await sourceRunService.initialize();
	const page = await findFailedRetryCandidates(input);
	let retried = 0,
		skipped = 0,
		failed = 0;
	for (const candidate of page.candidates) {
		try {
			switch (candidate.kind) {
				case "batch":
					await batchRunService.retry(candidate.id, "failed");
					break;
				case "download":
					await downloadRunService.retry(candidate.id);
					break;
				case "source":
					await sourceRunService.retry(candidate.id);
					break;
			}
			retried++;
		} catch (error) {
			if (
				error instanceof ResourceConflictError ||
				error instanceof ResourceNotFoundError
			)
				skipped++;
			else {
				failed++;
				logger.error(
					{ err: error, runId: candidate.id },
					"Failed operation could not be queued for retry",
				);
			}
		}
	}
	const last = page.candidates.at(-1);
	return {
		retried,
		skipped,
		failed,
		cursor:
			page.hasMore && last ? { before: page.before, afterId: last.id } : null,
	};
}
