import { z } from "zod";

export const processingStepKindSchema = z.enum([
	"metadata",
	"thumbnail",
	"ai_dispatch",
]);
export type ProcessingStepKind = z.infer<typeof processingStepKindSchema>;

export const processingStepSchema = z.object({
	status: z.enum(["pending", "in_progress", "completed", "failed", "skipped"]),
	attemptCount: z.number().int().nonnegative(),
	updatedAt: z.iso.datetime().nullable(),
});
export type ProcessingStep = z.infer<typeof processingStepSchema>;

/** A checkpoint for one processMedia run, not the media's current processing state. */
export const mediaProcessingCheckpointSchema = z.object({
	version: z.literal(1),
	inputRevision: z.string().min(1),
	steps: z.object({
		metadata: processingStepSchema,
		thumbnail: processingStepSchema,
		ai_dispatch: processingStepSchema,
	}),
});
export type MediaProcessingCheckpoint = z.infer<
	typeof mediaProcessingCheckpointSchema
>;

export const processingStepDtoSchema = processingStepSchema.extend({
	kind: z.enum([...processingStepKindSchema.options, "tagging", "ccip"]),
});

export const processMediaPayloadSchema = z.object({
	requestRevision: z.string().optional(),
	mediaId: z.uuid(),
	skipMetadataExtraction: z.boolean().optional(),
	skipThumbnailGeneration: z.boolean().optional(),
});

export class JobAttemptLostError extends Error {
	constructor() {
		super("Job attempt is no longer active");
		this.name = "JobAttemptLostError";
	}
}
