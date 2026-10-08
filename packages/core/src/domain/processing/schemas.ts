import type { AppConfig } from "../config/config-schema";
import { z } from "zod";

export const mediaTaskKindSchema = z.enum([
	"metadata",
	"thumbnail",
	"tagging",
	"ccip",
]);
export type MediaTaskKind = z.infer<typeof mediaTaskKindSchema>;
export type FileTaskKind = Extract<MediaTaskKind, "metadata" | "thumbnail">;
export type AiTaskKind = Extract<MediaTaskKind, "tagging" | "ccip">;

export const processingRequestIdentitySchema = z.object({
	requestId: z.uuid(),
	requestedRevision: z.string().min(1),
});
export type ProcessingRequestIdentity = z.infer<
	typeof processingRequestIdentitySchema
>;
/** Internal observer payload. Never exposed through the public job DTO. */
export const aiProcessingObserverSchema = z.looseObject({
	processingRequests: z
		.record(z.uuid(), processingRequestIdentitySchema)
		.optional(),
	retryAiTasks: z.boolean().optional(),
	force: z.boolean().optional(),
});

export const CCIP_MODEL = "ccip-caformer-24-randaug-pruned";
export const CCIP_EMBEDDING_VERSION = 1;
export const CCIP_VECTOR_DIMENSIONS = 768;

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

export const ccipProcessingSettingsSchema =
	taggingProcessingSettingsSchema.extend({
		embeddingVersion: z.number().int().positive(),
		dimensions: z.number().int().positive(),
	});
export type CcipProcessingSettings = z.infer<
	typeof ccipProcessingSettingsSchema
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

/** JSON-safe snapshot; never reconstruct a requested input from a later media row. */
export const scheduledMediaInputSchema = mediaProcessingInputSchema.extend({
	modifiedAt: z.iso.datetime(),
});
export type ScheduledMediaInput = z.infer<typeof scheduledMediaInputSchema>;

export const mediaProcessingRequestSchema = z.object({
	input: mediaProcessingInputSchema,
	taskKind: mediaTaskKindSchema,
	revision: z.string().min(1),
	maxAttempts: z.number().int().min(1).max(20).default(5),
	force: z.boolean().default(false),
});
export type MediaProcessingRequest = z.infer<
	typeof mediaProcessingRequestSchema
>;

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
	requestId: z.uuid(),
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
	executionMode: z.enum(["inline", "scheduled"]),
	availableAt: z.date(),
	maxAttempts: z.number().int().min(1).max(20),
	ownerJobId: z.uuid().nullable(),
	ownerAttemptCount: z.number().int().nullable(),
	lastError: z.string().nullable(),
	updatedAt: z.date(),
});
export type MediaProcessingState = z.infer<typeof mediaProcessingStateSchema>;

export const scheduledMediaWorkSchema = z.object({
	input: mediaProcessingInputSchema,
	claim: mediaProcessingClaimSchema,
	state: mediaProcessingStateSchema,
});
export type ScheduledMediaWork = z.infer<typeof scheduledMediaWorkSchema>;

export class MediaProcessingSupersededError extends Error {
	constructor() {
		super("Media processing input or claim has been superseded");
		this.name = "MediaProcessingSupersededError";
	}
}

export class MediaProcessingScheduledError extends Error {
	constructor() {
		super("Media task is owned by the dedicated scheduler");
		this.name = "MediaProcessingScheduledError";
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
