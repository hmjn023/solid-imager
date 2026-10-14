import { implement, ORPCError } from "@orpc/server";
import { jobsContract } from "@solid-imager/core/domain/contract/jobs.contract";
import type { JobEvent } from "@solid-imager/core/domain/sources/events";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { findCurrentProcessingSteps } from "../media-processing-status";
import { findBatchJob, mutateBatchJob } from "../batch-job-view";
import {
	findSourceJob,
	mutateSourceRun,
	toSourceJobDto,
} from "../source-run-view";
import {
	findDownloadJob,
	mutateDownloadJob,
	listJobView,
} from "../download-job-view";
import { resolveJobArtifact } from "../job-artifact";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
const os = implement(jobsContract);
export const jobsRouter = os.router({
	list: os.list.handler(async ({ input }) => {
		const page = await listJobView(input);
		const ids = [
			...new Set(
				page.items.flatMap((job) =>
					job.targetMediaId ? [job.targetMediaId] : [],
				),
			),
		];
		const media = await MediaRepository.findByIds(ids),
			modified = new Map(media.map((item) => [item.id, item.modifiedAt]));
		const steps = await findCurrentProcessingSteps(ids);
		return {
			items: page.items.map((job) => ({
				...job,
				targetMediaModifiedAt: modified.get(job.targetMediaId ?? "") ?? null,
				currentProcessingSteps: steps.get(job.targetMediaId ?? "") ?? [],
			})),
			total: page.total,
		};
	}),
	get: os.get.handler(async ({ input }) => {
		const run =
			(await findDownloadJob(input.id)) ??
			(await findBatchJob(input.id)) ??
			(await findSourceJob(input.id));
		if (!run)
			throw new ORPCError("NOT_FOUND", { message: "Operation not found" });
		return run;
	}),
	downloadArtifact: os.downloadArtifact.handler(async ({ input }) => {
		const artifact = await resolveJobArtifact(input.id);
		if (!artifact)
			throw new ORPCError("NOT_FOUND", { message: "Artifact not found" });
		return artifact.stream;
	}),
	retry: os.retry.handler(async ({ input }) => {
		if (await findDownloadJob(input.id))
			return mutateDownloadJob("retry", input.id);
		if (await findBatchJob(input.id)) return mutateBatchJob("retry", input.id);
		if (await findSourceJob(input.id))
			return toSourceJobDto(await mutateSourceRun("retry", input.id));
		throw new ORPCError("NOT_FOUND", { message: "Operation not found" });
	}),
	cancel: os.cancel.handler(async ({ input }) => {
		if (await findDownloadJob(input.id))
			return mutateDownloadJob("cancel", input.id);
		if (await findBatchJob(input.id)) return mutateBatchJob("cancel", input.id);
		if (await findSourceJob(input.id))
			return toSourceJobDto(await mutateSourceRun("cancel", input.id));
		throw new ORPCError("NOT_FOUND", { message: "Operation not found" });
	}),

	events: os.events.handler(async function* ({ signal }) {
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
});
