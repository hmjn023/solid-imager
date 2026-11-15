import {
	jobProgressSchema,
	type IJobRepository,
} from "@solid-imager/core/jobs";
import { logger } from "~/infrastructure/logger";
import { notifyJob } from "./state-notifications";

export async function notifyBatchState(
	repo: Pick<IJobRepository, "findById">,
	id: string,
) {
	try {
		const job = await repo.findById(id);
		if (!job) return;
		if (job.status === "completed")
			notifyJob("job-completed", { jobId: id, message: "Batch completed" });
		else if (job.status === "failed")
			notifyJob("job-failed", { jobId: id, error: "A batch job failed" });
		else if (job.status === "cancelled")
			notifyJob("job-cancelled", { jobId: id, message: "Batch cancelled" });
		else {
			const progress = jobProgressSchema.safeParse(job.payload);
			if (progress.success && progress.data)
				notifyJob("job-progress", {
					jobId: id,
					processed: progress.data.processed,
					total: progress.data.total,
					failed: progress.data.failed,
					cancelled: progress.data.cancelled,
				});
		}
	} catch (err) {
		logger.error({ err, jobId: id }, "Failed to notify batch state");
	}
}
