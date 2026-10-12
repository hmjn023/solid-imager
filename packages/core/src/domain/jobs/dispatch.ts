import { z } from "zod";
import { downloadItemSchema } from "../media/schemas";
import { generateThumbnailJobPayloadSchema } from "../thumbnails/schemas";
import {
	processMediaPayloadSchema,
	sourceExportJobPayloadSchema,
	sourceRestoreJobPayloadSchema,
} from "./schemas";

export const autoTaggingPayloadSchema = z.object({
	mediaId: z.uuid(),
	force: z.boolean().optional(),
});
export const bulkTaggingDispatchPayloadSchema = z.object({
	force: z.boolean().optional(),
	batchSize: z.number().int().min(1).optional(),
	mediaSourceId: z.uuid().optional(),
});
export const batchCcipDispatchPayloadSchema =
	bulkTaggingDispatchPayloadSchema.extend({
		batchSize: z.number().int().min(1).max(5000).optional(),
	});
export const singleExtractionPayloadSchema = z.object({
	mediaId: z.uuid(),
	force: z.boolean().default(false),
});
export const batchExtractionPayloadSchema = z.object({
	mediaIds: z.array(z.uuid()).min(1).max(25),
	force: z.boolean().default(false),
});
export const extractionPayloadSchema = z.union([
	singleExtractionPayloadSchema,
	batchExtractionPayloadSchema,
]);

/** Runnable jobs only. Batch parents and approval requests are never executable. */
export const executableJobSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("processMedia"),
		payload: processMediaPayloadSchema,
	}),
	z.object({ type: z.literal("downloadImage"), payload: downloadItemSchema }),
	z.object({
		type: z.literal("auto_tagging"),
		payload: autoTaggingPayloadSchema,
	}),
	z.object({
		type: z.literal("extract_ccip_vector"),
		payload: extractionPayloadSchema,
	}),
	z.object({
		type: z.literal("bulk_tagging_dispatch"),
		payload: bulkTaggingDispatchPayloadSchema,
	}),
	z.object({
		type: z.literal("batch_ccip_dispatch"),
		payload: batchCcipDispatchPayloadSchema,
	}),
	z.object({
		type: z.literal("generate_thumbnail"),
		payload: generateThumbnailJobPayloadSchema,
	}),
	z.object({
		type: z.literal("source_export"),
		payload: sourceExportJobPayloadSchema,
	}),
	z.object({
		type: z.literal("source_restore"),
		payload: sourceRestoreJobPayloadSchema,
	}),
]);
export type ExecutableJob = z.infer<typeof executableJobSchema>;

export class InvalidJobError extends Error {
	constructor(
		message: "Unsupported job type" | "Invalid job payload",
		cause?: Error,
	) {
		super(message, { cause });
		this.name = "InvalidJobError";
	}
}
