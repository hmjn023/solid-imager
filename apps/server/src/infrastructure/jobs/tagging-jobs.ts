import {
	createJobEventPublisher,
	runAutoTaggingJob,
	runBulkTaggingDispatchJob,
} from "@solid-imager/application/services/tagging-job-runner";
import { and, asc, eq, notExists } from "drizzle-orm";
import { services } from "~/application/registry";
import { taggingService } from "~/application/services/tagging-service";
import { db } from "~/infrastructure/db";
import {
	type Job,
	mediaCharacters,
	mediaIps,
	medias,
	mediaTags,
} from "~/infrastructure/db/schema";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { logger } from "~/infrastructure/logger";

type AutoTaggingJobPayload = {
	mediaId: string;
	force?: boolean;
};

type BulkTaggingDispatchJobPayload = {
	force?: boolean;
	batchSize?: number;
	mediaSourceId?: string;
};

export async function processAutoTaggingJob(job: Job): Promise<void> {
	const JOB_EVENTS_CHANNEL = "global-jobs";
	await runAutoTaggingJob(job, {
		jobRepository: services.getJobRepository(),
		executeAutoTagging: async ({ mediaId, mediaSourceId, force }) => {
			await taggingService.getTagsForMedia(mediaSourceId, mediaId, {
				skipCache: force,
			});
		},
		jobEvents: createJobEventPublisher((event, payload) => {
			SseManager.sendEvent(JOB_EVENTS_CHANNEL, event, payload);
		}),
		logger,
	});
}

export async function processBulkTaggingDispatchJob(job: Job): Promise<void> {
	await runBulkTaggingDispatchJob(job, {
		jobRepository: services.getJobRepository(),
		scanTargets: async (payload) => {
			const force = payload.force ?? false;
			const batchSize = payload.batchSize ?? 1000;
			const mediaSourceId = payload.mediaSourceId;
			const whereClause = and(
				eq(medias.mediaType, "image"),
				mediaSourceId ? eq(medias.mediaSourceId, mediaSourceId) : undefined,
				force
					? undefined
					: and(
							notExists(
								db
									.select()
									.from(mediaTags)
									.where(
										and(
											eq(mediaTags.mediaId, medias.id),
											eq(mediaTags.source, "AI"),
										),
									),
							),
							notExists(
								db
									.select()
									.from(mediaCharacters)
									.where(
										and(
											eq(mediaCharacters.mediaId, medias.id),
											eq(mediaCharacters.source, "AI"),
										),
									),
							),
							notExists(
								db
									.select()
									.from(mediaIps)
									.where(
										and(
											eq(mediaIps.mediaId, medias.id),
											eq(mediaIps.source, "AI"),
										),
									),
							),
						),
			);

			let offset = 0;
			const results: Array<{ id: string; mediaSourceId: string }> = [];
			while (true) {
				const rows = await db
					.select({
						id: medias.id,
						mediaSourceId: medias.mediaSourceId,
					})
					.from(medias)
					.where(whereClause)
					.orderBy(asc(medias.id))
					.limit(batchSize)
					.offset(offset);
				if (rows.length === 0) {
					break;
				}
				results.push(...rows);
				offset += batchSize;
			}
			return results;
		},
		logger,
	});
}
