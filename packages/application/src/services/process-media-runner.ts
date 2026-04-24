import type { Media } from "@solid-imager/core/domain/media/schemas";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { TagRepository } from "@solid-imager/core/domain/repositories/tag-repository";
import {
	hasMediaProcessingStep,
	MEDIA_PROCESSING_STEPS,
	type MediaProcessingJobPayload,
	type MediaProcessingStep,
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
	emitThumbnailGenerated(input: {
		media: Media;
		mediaSourceId: string;
	}): Promise<void> | void;
	queueAutoTagging(input: {
		mediaId: string;
		mediaSourceId: string;
	}): Promise<void>;
	isAutoTaggingEnabled(): boolean | Promise<boolean>;
	logger?: ProcessMediaRunnerLogger;
};

export async function runProcessMediaJob(
	job: {
		id: string;
		mediaSourceId: string | null;
		payload: unknown;
	},
	deps: ProcessMediaRunnerDeps,
): Promise<void> {
	const payload = parseProcessMediaPayload(job.payload);
	if (!payload?.mediaId) {
		deps.logger?.error?.({ jobId: job.id }, "Missing mediaId in job payload");
		return;
	}

	const media = await deps.mediaRepository.findById(payload.mediaId);
	if (!media) {
		deps.logger?.warn?.(
			{ mediaId: payload.mediaId },
			"Media not found for processMedia job",
		);
		return;
	}

	if (!job.mediaSourceId) {
		deps.logger?.error?.({ jobId: job.id }, "Missing mediaSourceId in job");
		return;
	}

	const fullPath = await deps.pathJoin(payload.sourcePath, media.filePath);

	if (hasMediaProcessingStep(payload, "extractMetadata")) {
		await extractMetadata(payload, fullPath, deps);
	}

	if (hasMediaProcessingStep(payload, "generateThumbnail")) {
		await generateThumbnail(media, job.mediaSourceId, payload, fullPath, deps);
	}

	if (
		(await deps.isAutoTaggingEnabled()) &&
		hasMediaProcessingStep(payload, "queueAutoTagging") &&
		media.mediaType === "image"
	) {
		await deps.queueAutoTagging({
			mediaId: media.id,
			mediaSourceId: job.mediaSourceId,
		});
	}
}

function parseProcessMediaPayload(
	payload: unknown,
): MediaProcessingJobPayload | null {
	if (
		typeof payload === "object" &&
		payload !== null &&
		"mediaId" in payload &&
		typeof payload.mediaId === "string" &&
		"sourcePath" in payload &&
		typeof payload.sourcePath === "string"
	) {
		const steps =
			"steps" in payload && Array.isArray(payload.steps)
				? payload.steps.filter((step): step is MediaProcessingStep =>
						MEDIA_PROCESSING_STEPS.includes(step as MediaProcessingStep),
					)
				: undefined;
		return {
			mediaId: payload.mediaId,
			sourcePath: payload.sourcePath,
			steps,
			type:
				"type" in payload && payload.type === "processMedia"
					? "processMedia"
					: undefined,
		};
	}
	return null;
}

async function extractMetadata(
	payload: MediaProcessingJobPayload,
	fullPath: string,
	deps: ProcessMediaRunnerDeps,
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
			await deps.tagRepository.addTagsToMedia(
				payload.mediaId,
				metadata.tags,
				"comfyui_workflow",
			);
		}
	} catch (error) {
		deps.logger?.warn?.(
			{ err: error, mediaId: payload.mediaId },
			"Metadata extraction failed, continuing...",
		);
	}
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
		deps.logger?.error?.(
			{ err: error, mediaId: payload.mediaId },
			"Thumbnail generation failed",
		);
	}
}
