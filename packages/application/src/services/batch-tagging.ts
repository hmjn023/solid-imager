import type { JobRepositoryPort } from "@solid-imager/application/ports/job-repository";
import { and, type AnyColumn, asc, eq, getTableColumns, isNull, type Table } from "drizzle-orm";

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

export interface BatchTaggingTables {
	medias: Table & {
		id: AnyColumn;
		mediaType: AnyColumn;
		mediaSourceId: AnyColumn;
	};
	mediaTags: Table & {
		mediaId: AnyColumn;
		source: AnyColumn;
	};
	mediaCharacters: Table & {
		mediaId: AnyColumn;
		source: AnyColumn;
	};
	mediaIps: Table & {
		mediaId: AnyColumn;
		source: AnyColumn;
	};
}

/**
 * Scans for media items that haven't been tagged by AI yet.
 * Uses Drizzle query builder — caller provides db instance and table references.
 */
export async function scanBatchTaggingTargets(
	db: any,
	input: BatchTaggingInput,
	tables: BatchTaggingTables,
): Promise<unknown[]> {
	const { mediaSourceId, force } = input;
	const { medias, mediaTags, mediaCharacters, mediaIps } = tables;

	const results = await db
		.select({
			...getTableColumns(medias),
		})
		.from(medias)
		.leftJoin(
			mediaTags,
			and(
				eq(mediaTags.mediaId, medias.id),
				eq(mediaTags.source, AI_SOURCE),
			),
		)
		.leftJoin(
			mediaCharacters,
			and(
				eq(mediaCharacters.mediaId, medias.id),
				eq(mediaCharacters.source, AI_SOURCE),
			),
		)
		.leftJoin(
			mediaIps,
			and(
				eq(mediaIps.mediaId, medias.id),
				eq(mediaIps.source, AI_SOURCE),
			),
		)
		.where(
			and(
				eq(medias.mediaType, "image"),
				mediaSourceId
					? eq(medias.mediaSourceId, mediaSourceId)
					: undefined,
				force
					? undefined
					: and(
							isNull(mediaTags.mediaId),
							isNull(mediaCharacters.mediaId),
							isNull(mediaIps.mediaId),
						),
			),
		)
		.orderBy(asc(medias.id));

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
