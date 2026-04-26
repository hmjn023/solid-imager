import type { Media } from "@solid-imager/core/domain/media/schemas";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { TagRepository } from "@solid-imager/core/domain/repositories/tag-repository";
import {
	hasMediaProcessingStep,
	type MediaProcessingJobPayload,
	parseMediaProcessingJobPayload,
} from "./media-processing-job";

type MetadataExtractor = (path: string) => Promise<{
	prompt: unknown;
	workflow: unknown;
	tags: { name: string; type: "positive" | "negative"; confidence?: number }[];
}>;

type ProcessMediaRunnerLogger = {
	error?(data: unknown, message?: string): void;
	warn?(data: unknown, message?: string): void;
};

export type ProcessMediaRunnerDeps = {
	mediaRepository: Pick<IMediaRepository, "findById" | "upsertGenerationInfo">;
	tagRepository: Pick<TagRepository, "addTagsToMedia">;
	pathJoin(basePath: string, filePath: string): Promise<string> | string;
	extractMetadata: MetadataExtractor;
	generateThumbnail(input: {
		media: Media;
		mediaSourceId: string;
		sourcePath: string;
		fullPath: string;
	}): Promise<void>;
	emitThumbnailGenerated(input: { media: Media; mediaSourceId: string }): Promise<void> | void;
	queueAutoTagging(input: { mediaId: string; mediaSourceId: string }): Promise<void>;
	isAutoTaggingEnabled(): boolean | Promise<boolean>;
	logger?: ProcessMediaRunnerLogger;
};

export type ProcessMediaBatchJobResult = {
	jobId: string;
	mediaSourceId: string | null;
	status: "completed" | "failed";
	error?: string;
};

export type ProcessMediaBatchRunnerDeps = Omit<ProcessMediaRunnerDeps, "generateThumbnail"> & {
	generateThumbnails(input: ProcessMediaThumbnailInput[]): Promise<void>;
};

export type ProcessMediaThumbnailInput = {
	media: Media;
	mediaSourceId: string;
	sourcePath: string;
	fullPath: string;
};

type ProcessMediaCoreDeps = Pick<
	ProcessMediaRunnerDeps,
	| "mediaRepository"
	| "tagRepository"
	| "pathJoin"
	| "extractMetadata"
	| "queueAutoTagging"
	| "isAutoTaggingEnabled"
	| "logger"
>;

type ProcessMediaBatchItem = {
	job: {
		id: string;
		mediaSourceId: string;
		payload: unknown;
	};
	payload: MediaProcessingJobPayload;
	media: Media;
	fullPath: string;
};

export async function runProcessMediaJob(
	job: {
		id: string;
		mediaSourceId: string | null;
		payload: unknown;
	},
	deps: ProcessMediaRunnerDeps,
): Promise<void> {
	const item = await resolveProcessMediaItem(job, deps);
	if (!item) {
		return;
	}

	await extractMetadataIfNeeded(item, deps);

	if (hasMediaProcessingStep(item.payload, "generateThumbnail")) {
		await generateThumbnail(item.media, item.job.mediaSourceId, item.payload, item.fullPath, deps);
	}

	await queueAutoTaggingIfNeeded(item, deps);
}

export async function runProcessMediaBatchJobs(
	jobs: Array<{
		id: string;
		mediaSourceId: string | null;
		payload: unknown;
	}>,
	deps: ProcessMediaBatchRunnerDeps,
): Promise<ProcessMediaBatchJobResult[]> {
	const results: ProcessMediaBatchJobResult[] = [];
	const items: ProcessMediaBatchItem[] = [];

	for (const job of jobs) {
		try {
			const item = await resolveProcessMediaItem(job, deps);
			if (!item) {
				results.push({
					jobId: job.id,
					mediaSourceId: job.mediaSourceId,
					status: "completed",
				});
				continue;
			}
			items.push(item);
		} catch (error) {
			results.push({
				jobId: job.id,
				mediaSourceId: job.mediaSourceId,
				status: "failed",
				error: getErrorMessage(error),
			});
		}
	}

	for (const item of items) {
		try {
			await extractMetadataIfNeeded(item, deps);
		} catch (error) {
			results.push({
				jobId: item.job.id,
				mediaSourceId: item.job.mediaSourceId,
				status: "failed",
				error: getErrorMessage(error),
			});
		}
	}

	const itemsById = new Map(items.map((item) => [item.job.id, item]));
	for (const result of results) {
		if (result.status === "failed") {
			itemsById.delete(result.jobId);
		}
	}
	const runnableItems = [...itemsById.values()];

	const thumbnailItems = runnableItems
		.filter((item) => hasMediaProcessingStep(item.payload, "generateThumbnail"))
		.map(
			(item): ProcessMediaThumbnailInput => ({
				media: item.media,
				mediaSourceId: item.job.mediaSourceId,
				sourcePath: item.payload.sourcePath,
				fullPath: item.fullPath,
			}),
		);

	if (thumbnailItems.length > 0) {
		try {
			await deps.generateThumbnails(thumbnailItems);
			for (const item of runnableItems) {
				if (hasMediaProcessingStep(item.payload, "generateThumbnail")) {
					await deps.emitThumbnailGenerated({
						media: item.media,
						mediaSourceId: item.job.mediaSourceId,
					});
				}
			}
		} catch (error) {
			deps.logger?.error?.({ err: error }, "Batch thumbnail generation failed");
		}
	}

	for (const item of runnableItems) {
		try {
			await queueAutoTaggingIfNeeded(item, deps);
			results.push({
				jobId: item.job.id,
				mediaSourceId: item.job.mediaSourceId,
				status: "completed",
			});
		} catch (error) {
			results.push({
				jobId: item.job.id,
				mediaSourceId: item.job.mediaSourceId,
				status: "failed",
				error: getErrorMessage(error),
			});
		}
	}

	return results;
}

async function resolveProcessMediaItem(
	job: {
		id: string;
		mediaSourceId: string | null;
		payload: unknown;
	},
	deps: Pick<ProcessMediaCoreDeps, "mediaRepository" | "pathJoin" | "logger">,
): Promise<ProcessMediaBatchItem | null> {
	const payload = parseMediaProcessingJobPayload(job.payload);
	if (!payload) {
		deps.logger?.error?.({ jobId: job.id }, "Missing mediaId in job payload");
		return null;
	}

	const media = await deps.mediaRepository.findById(payload.mediaId);
	if (!media) {
		deps.logger?.warn?.({ mediaId: payload.mediaId }, "Media not found for processMedia job");
		return null;
	}

	if (!job.mediaSourceId) {
		deps.logger?.error?.({ jobId: job.id }, "Missing mediaSourceId in job");
		return null;
	}

	const fullPath = await deps.pathJoin(payload.sourcePath, media.filePath);

	return {
		job: {
			id: job.id,
			mediaSourceId: job.mediaSourceId,
			payload: job.payload,
		},
		payload,
		media,
		fullPath,
	};
}

async function extractMetadataIfNeeded(
	item: ProcessMediaBatchItem,
	deps: ProcessMediaCoreDeps,
): Promise<void> {
	if (!hasMediaProcessingStep(item.payload, "extractMetadata")) return;
	await extractMetadata(item.payload, item.fullPath, deps);
}

async function extractMetadata(
	payload: MediaProcessingJobPayload,
	fullPath: string,
	deps: Pick<
		ProcessMediaCoreDeps,
		"extractMetadata" | "mediaRepository" | "tagRepository" | "logger"
	>,
): Promise<void> {
	try {
		const metadata = await deps.extractMetadata(fullPath);
		await deps.mediaRepository.upsertGenerationInfo(
			payload.mediaId,
			metadata.prompt !== null && typeof metadata.prompt === "object"
				? JSON.stringify(metadata.prompt)
				: typeof metadata.prompt === "string"
					? metadata.prompt
					: null,
			metadata.workflow !== null && typeof metadata.workflow === "object"
				? metadata.workflow
				: null,
		);

		if (metadata.tags.length > 0) {
			await deps.tagRepository.addTagsToMedia(payload.mediaId, metadata.tags, "comfyui_workflow");
		}
	} catch (error) {
		deps.logger?.warn?.(
			{ err: error, mediaId: payload.mediaId },
			"Metadata extraction failed, continuing...",
		);
	}
}

async function queueAutoTaggingIfNeeded(
	item: ProcessMediaBatchItem,
	deps: Pick<ProcessMediaCoreDeps, "isAutoTaggingEnabled" | "queueAutoTagging">,
): Promise<void> {
	if (
		(await deps.isAutoTaggingEnabled()) &&
		hasMediaProcessingStep(item.payload, "queueAutoTagging") &&
		item.media.mediaType === "image"
	) {
		await deps.queueAutoTagging({
			mediaId: item.media.id,
			mediaSourceId: item.job.mediaSourceId,
		});
	}
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function generateThumbnail(
	media: Media,
	mediaSourceId: string,
	payload: MediaProcessingJobPayload,
	fullPath: string,
	deps: ProcessMediaRunnerDeps,
): Promise<void> {
	try {
		await deps.generateThumbnail({
			media,
			mediaSourceId,
			sourcePath: payload.sourcePath,
			fullPath,
		});
		await deps.emitThumbnailGenerated({ media, mediaSourceId });
	} catch (error) {
		deps.logger?.error?.({ err: error, mediaId: payload.mediaId }, "Thumbnail generation failed");
	}
}
