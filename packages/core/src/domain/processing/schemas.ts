import type { AppConfig } from "../config/config-schema";
import { z } from "zod";

export const mediaTaskKindSchema = z.enum(["metadata", "thumbnail", "tagging"]);
export type MediaTaskKind = z.infer<typeof mediaTaskKindSchema>;
export type FileTaskKind = Exclude<MediaTaskKind, "tagging">;

export const taggingProcessingSettingsSchema = z.object({
	model: z.string(),
	modelVersion: z.string(),
	runtimeVersion: z.string(),
	provider: z.string(),
	device: z.string().nullable(),
	endpoint: z.string(),
});
export type TaggingProcessingSettings = z.infer<
	typeof taggingProcessingSettingsSchema
>;

export const mediaProcessingInputSchema = z.object({
	mediaId: z.uuid(),
	mediaSourceId: z.uuid(),
	sourcePath: z.string(),
	filePath: z.string(),
	modifiedAt: z.date(),
	fileSize: z.number().nullable(),
	mediaType: z.enum(["image", "video", "audio"]),
});
export type MediaProcessingInput = z.infer<typeof mediaProcessingInputSchema>;

export const processingSettingsSchema = z.object({
	metadata: z.object({
		positiveNodeTypes: z.array(z.string()),
		negativeKeywords: z.array(z.string()),
		negativeTags: z.array(z.string()),
	}),
	thumbnail: z.object({
		directory: z.string(),
		size: z.number(),
		quality: z.number(),
	}),
});
export type ProcessingSettings = z.infer<typeof processingSettingsSchema>;

export const processingOwnerSchema = z.object({
	jobId: z.uuid(),
	attemptCount: z.number().int().nonnegative(),
});
export type ProcessingOwner = z.infer<typeof processingOwnerSchema>;
export const mediaProcessingClaimSchema = z.object({
	mediaId: z.uuid(),
	taskKind: mediaTaskKindSchema,
	revision: z.string(),
	token: z.uuid(),
});
export type MediaProcessingClaim = z.infer<typeof mediaProcessingClaimSchema>;
export const mediaProcessingStateSchema = z.object({
	mediaId: z.uuid(),
	taskKind: mediaTaskKindSchema,
	status: z.enum(["pending", "in_progress", "completed", "failed"]),
	inputRevision: z.string(),
	requestedRevision: z.string(),
	completedRevision: z.string().nullable(),
	claimToken: z.uuid().nullable(),
	claimedAt: z.date().nullable(),
	heartbeatAt: z.date().nullable(),
	attemptCount: z.number().int().nonnegative(),
	ownerJobId: z.uuid().nullable(),
	ownerAttemptCount: z.number().int().nullable(),
	lastError: z.string().nullable(),
	updatedAt: z.date(),
});
export type MediaProcessingState = z.infer<typeof mediaProcessingStateSchema>;

export class MediaProcessingSupersededError extends Error {
	constructor() {
		super("Media processing input or claim has been superseded");
		this.name = "MediaProcessingSupersededError";
	}
}

/** Fixed field order, ISO UTC timestamp, numeric byte count; shared by all producers. */
export function serializeMediaProcessingInput(
	input: Omit<MediaProcessingInput, "mediaType">,
): string {
	return JSON.stringify([
		input.mediaId,
		input.mediaSourceId,
		input.sourcePath,
		input.filePath,
		input.modifiedAt.toISOString(),
		input.fileSize,
	]);
}

export function processingSettingsFromConfig(
	config: AppConfig,
): ProcessingSettings {
	return {
		metadata: config.media.tagExtraction.comfyui,
		thumbnail: {
			directory: config.storage.thumbnailDir,
			size: config.storage.thumbnailSize,
			quality: config.storage.thumbnailQuality,
		},
	};
}

/** Bump this task's version when processor or output semantics change. */
export function serializeMediaTaskRevision(
	input: MediaProcessingInput,
	kind: FileTaskKind,
	settings: ProcessingSettings,
): string {
	const options =
		kind === "metadata"
			? [
					settings.metadata.positiveNodeTypes,
					settings.metadata.negativeKeywords,
					settings.metadata.negativeTags,
				]
			: [
					settings.thumbnail.directory,
					settings.thumbnail.size,
					settings.thumbnail.quality,
					[512, 256],
				];
	return JSON.stringify([
		kind === "metadata" ? "metadata-v1" : "thumbnail-v1",
		kind,
		serializeMediaProcessingInput(input),
		input.mediaType,
		options,
	]);
}
