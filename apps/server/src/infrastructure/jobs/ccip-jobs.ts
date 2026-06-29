import { getErrorMessage } from "@solid-imager/core/utils";
import { z } from "zod";
import { services } from "~/application/registry";
import { ccipVectorService } from "~/application/services/ccip-vector-service";
import type { Job } from "~/infrastructure/db/schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";

const payloadSchema = z.object({
	mediaId: z.string().uuid(),
	force: z.boolean().default(false),
});

const parentPayloadSchema = z.object({
	total: z.number().int().nonnegative(),
	processed: z.number().int().nonnegative(),
	processedJobIds: z.array(z.string().uuid()).optional(),
});

async function updateParent(job: Job): Promise<void> {
	if (!job.parentId) return;
	const jobRepository = services.getJobRepository();
	const updated = await jobRepository.incrementProgress(job.parentId, job.id);
	if (!updated) {
		return;
	}
	const parent = await jobRepository.findById(job.parentId);
	if (!parent) return;
	const payload = parentPayloadSchema.parse(parent.payload);
	RealtimeEventBus.publishJob("job-progress", {
		jobId: parent.id,
		processed: payload.processed,
		total: payload.total,
	});
	if (parent.status !== "failed" && payload.processed >= payload.total) {
		await jobRepository.markAsCompleted(parent.id, { success: true });
		RealtimeEventBus.publishJob("job-completed", {
			jobId: parent.id,
			message: "CCIP vector extraction completed",
		});
	}
}

export async function processCcipExtractionJob(job: Job): Promise<void> {
	const payload = payloadSchema.parse(job.payload);
	if (!job.mediaSourceId) {
		throw new Error("CCIP extraction job is missing mediaSourceId");
	}
	try {
		const result = await ccipVectorService.extract(
			job.mediaSourceId,
			payload.mediaId,
			payload.force,
		);
		logger.info(
			{
				jobId: job.id,
				parentId: job.parentId,
				mediaSourceId: job.mediaSourceId,
				mediaId: payload.mediaId,
				force: payload.force,
				skipped: result.skipped,
			},
			"CCIP vector extraction completed",
		);
		RealtimeEventBus.publishJob("job-completed", {
			jobId: job.id,
			message: "CCIP vector extraction completed",
		});
		await updateParent(job);
	} catch (error) {
		logger.error(
			{ err: error, mediaId: payload.mediaId },
			"CCIP vector extraction failed",
		);
		RealtimeEventBus.publishJob("job-failed", {
			jobId: job.id,
			error: getErrorMessage(error),
		});
		if (job.parentId) {
			await services
				.getJobRepository()
				.markAsFailed(job.parentId, getErrorMessage(error));
			RealtimeEventBus.publishJob("job-failed", {
				jobId: job.parentId,
				error: getErrorMessage(error),
			});
		}
		throw error;
	}
}
