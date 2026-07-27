import { eventIterator, os } from "@orpc/server";
import {
	getSafeJobErrorMessage,
	type SafeJob,
} from "@solid-imager/core/domain/jobs/schemas";
import type { Job } from "@solid-imager/core/domain/repositories/job-repository";
import { batchParentPayloadSchema } from "@solid-imager/core/domain/tagging/schemas";
import {
	type JobEvent,
	jobEventSchema,
} from "@solid-imager/core/domain/sources/events";
import { z } from "zod";
import { services } from "~/application/registry";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";

export const jobsRouter = {
	get: os
		.input(z.object({ id: z.string().uuid() }))
		.handler(async ({ input }): Promise<SafeJob | null> => {
			const job = await services.getJobRepository().findById(input.id);
			return job ? toSafeJob(job) : null;
		}),
	events: os.output(eventIterator(jobEventSchema)).handler(async function* ({
		signal,
	}) {
		const queue: JobEvent[] = [];
		let resolve: (() => void) | null = null;

		const unsubscribe = RealtimeEventBus.subscribeToJobs((event) => {
			queue.push(event);
			resolve?.();
			resolve = null;
		});

		try {
			while (!signal?.aborted) {
				if (queue.length === 0) {
					if (signal?.aborted) {
						break;
					}
					await new Promise<void>((done) => {
						if (signal?.aborted) {
							done();
							return;
						}
						const onAbort = () => {
							done();
						};
						signal?.addEventListener("abort", onAbort, { once: true });
						resolve = () => {
							signal?.removeEventListener("abort", onAbort);
							done();
						};
					});
				}

				while (queue.length > 0) {
					const event = queue.shift();
					if (event) {
						yield event;
					}
				}
			}
		} finally {
			unsubscribe();
		}
	}),
};

export function toSafeJob(job: Job): SafeJob {
	const progress = batchParentPayloadSchema.safeParse(job.payload);
	return {
		id: job.id,
		type: job.type,
		status: job.status,
		queueName: job.queueName,
		targetId: job.targetId,
		inputRevision: job.inputRevision,
		attemptCount: job.attemptCount,
		maxAttempts: job.maxAttempts,
		errorCode: job.errorCode,
		errorMessage: getSafeJobErrorMessage(job.errorCode),
		progress:
			job.type === "bulk_tagging_parent" || job.type === "batch_ccip_parent"
				? progress.success
					? {
							processed: progress.data.processed,
							failed: progress.data.failed,
							total: progress.data.total,
						}
					: { processed: 0, failed: 0, total: 0 }
				: null,
		createdAt: job.createdAt,
		updatedAt: job.updatedAt,
		parentId: job.parentId,
	};
}
