import type { JobRepositoryPort } from "@solid-imager/application/ports/job-repository";
import { and, asc, eq, getTableColumns, isNull } from "drizzle-orm";

export const AI_SOURCE = "AI" as const;

export type BatchTaggingInput = {
	force?: boolean;
	mediaSourceId?: string;
};

export type BatchTaggingWithIdsInput = BatchTaggingInput & {
	mediaIds: string[];
};

export type MediaLookupResult = {
	id: string;
	mediaSourceId: string;
};

/**
 * Scans for media items that haven't been tagged by AI yet.
 * Uses Drizzle query builder — caller provides db instance and table references.
 */
export async function scanBatchTaggingTargets(
	db: unknown,
	input: BatchTaggingInput,
	tables: {
		medias: unknown;
		mediaTags: unknown;
		mediaCharacters: unknown;
		mediaIps: unknown;
	},
): Promise<unknown[]> {
	const { mediaSourceId, force } = input;
	const { medias, mediaTags, mediaCharacters, mediaIps } = tables;

	const results = await (db as any)
		.select({
			...getTableColumns(medias as any),
		})
		.from(medias as any)
		.leftJoin(
			mediaTags as any,
			and(
				eq((mediaTags as any).mediaId, (medias as any).id),
				eq((mediaTags as any).source, AI_SOURCE),
			),
		)
		.leftJoin(
			mediaCharacters as any,
			and(
				eq((mediaCharacters as any).mediaId, (medias as any).id),
				eq((mediaCharacters as any).source, AI_SOURCE),
			),
		)
		.leftJoin(
			mediaIps as any,
			and(
				eq((mediaIps as any).mediaId, (medias as any).id),
				eq((mediaIps as any).source, AI_SOURCE),
			),
		)
		.where(
			and(
				eq((medias as any).mediaType, "image"),
				mediaSourceId
					? eq((medias as any).mediaSourceId, mediaSourceId)
					: undefined,
				force
					? undefined
					: and(
							isNull((mediaTags as any).mediaId),
							isNull((mediaCharacters as any).mediaId),
							isNull((mediaIps as any).mediaId),
						),
			),
		)
		.orderBy(asc((medias as any).id));

	return results;
}

/**
 * Creates a bulk_tagging_dispatch job.
 */
export async function createBatchTaggingDispatchJob(
	jobRepo: JobRepositoryPort,
	input: BatchTaggingInput,
	payload: unknown,
): Promise<void> {
	await jobRepo.create({
		type: "bulk_tagging_dispatch",
		mediaSourceId: input.mediaSourceId,
		payload,
	});
}

/**
 * Creates a bulk_tagging_parent job and child auto_tagging jobs for each media.
 * Uses mediaLookup callback so caller can decide how to resolve media IDs.
 */
export async function createBatchTaggingParentJob(
	jobRepo: JobRepositoryPort,
	mediaLookup: (ids: string[]) => Promise<MediaLookupResult[]>,
	input: BatchTaggingWithIdsInput,
): Promise<{ success: boolean; message: string; jobId: string }> {
	const { mediaIds, mediaSourceId, force } = input;

	const parentJob = await jobRepo.create({
		type: "bulk_tagging_parent",
		mediaSourceId,
		status: "in_progress",
		payload: {
			total: mediaIds.length,
			processed: 0,
		},
	});

	const mediaItems = await mediaLookup(mediaIds);

	await Promise.all(
		mediaItems.map((media) =>
			jobRepo.create({
				type: "auto_tagging",
				mediaSourceId: media.mediaSourceId,
				parentId: parentJob.id,
				payload: {
					mediaId: media.id,
					force,
				},
			}),
		),
	);

	return {
		success: true,
		message: "Batch tagging started with selected media.",
		jobId: parentJob.id,
	};
}
