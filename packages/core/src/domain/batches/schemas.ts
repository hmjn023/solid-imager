import { z } from "zod";
import {
	mediaTaskKindSchema,
	scheduledMediaInputSchema,
} from "../processing/schemas";

export const batchKindSchema = z.enum([
	"tagging",
	"ccip",
	"thumbnail",
	"metadata",
	"media",
]);
export const batchStatusSchema = z.enum([
	"pending",
	"in_progress",
	"completed",
	"failed",
	"cancelled",
	"blocked",
]);
export const batchItemStatusSchema = z.enum([
	"pending",
	"scheduled",
	"completed",
	"failed",
	"cancelled",
	"superseded",
	"blocked",
]);
export const batchInputSchema = z.object({
	kind: batchKindSchema,
	mediaSourceId: z.uuid().optional(),
	mediaIds: z.array(z.uuid()).min(1).max(5000).optional(),
	/** Recheck unfinished work only when capturing an explicit recovery page. */
	recovery: z.boolean().optional(),
	force: z.boolean().default(false),
	missingOnly: z.boolean().default(false),
	thumbnailSize: z.union([z.literal(256), z.literal(512)]).default(512),
});
export type BatchInput = z.infer<typeof batchInputSchema>;

export const batchRunSchema = z.object({
	id: z.uuid(),
	input: batchInputSchema.nullable(),
	status: batchStatusSchema,
	blockedReason: z.string().nullable(),
	dispatchComplete: z.boolean(),
	attemptCount: z.number().int().nonnegative(),
	maxAttempts: z.number().int().positive(),
	leaseToken: z.uuid().nullable(),
	leaseExpiresAt: z.coerce.date().nullable(),
	cancelRequestedAt: z.coerce.date().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	finishedAt: z.coerce.date().nullable(),
});
export type BatchRun = z.infer<typeof batchRunSchema>;
export const batchClaimSchema = batchRunSchema.extend({
	input: batchInputSchema,
	leaseToken: z.uuid(),
	leaseExpiresAt: z.coerce.date(),
});
export type BatchClaim = z.infer<typeof batchClaimSchema>;
export const batchItemSchema = z.object({
	id: z.uuid(),
	runId: z.uuid(),
	mediaId: z.uuid(),
	mediaSourceId: z.uuid(),
	kind: mediaTaskKindSchema,
	input: scheduledMediaInputSchema.nullable(),
	plannedRevision: z.string().nullable(),
	requestId: z.uuid().nullable(),
	requestedRevision: z.string().nullable(),
	status: batchItemStatusSchema,
	attemptCount: z.number().int().nonnegative(),
	failureCode: z.string().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	finishedAt: z.coerce.date().nullable(),
});
export type BatchItem = z.infer<typeof batchItemSchema>;
export const batchProgressSchema = z.object({
	total: z.number().int().nonnegative(),
	completed: z.number().int().nonnegative(),
	failed: z.number().int().nonnegative(),
	cancelled: z.number().int().nonnegative(),
	pending: z.number().int().nonnegative(),
});
export type BatchProgress = z.infer<typeof batchProgressSchema>;

export const safeBatchRunSchema = z.object({
	id: z.uuid(),
	kind: batchKindSchema.nullable(),
	mediaSourceId: z.uuid().nullable(),
	status: batchStatusSchema,
	progress: batchProgressSchema,
	canRetry: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	finishedAt: z.coerce.date().nullable(),
});
export type SafeBatchRun = z.infer<typeof safeBatchRunSchema>;
export const safeBatchItemSchema = batchItemSchema
	.pick({
		id: true,
		runId: true,
		mediaId: true,
		mediaSourceId: true,
		kind: true,
		status: true,
		attemptCount: true,
		createdAt: true,
		updatedAt: true,
		finishedAt: true,
	})
	.extend({
		failureCode: z
			.enum(["processing_failed", "input_changed", "legacy_blocked"])
			.nullable(),
	});

export const safeBatchAttemptSchema = safeBatchItemSchema
	.pick({
		status: true,
		attemptCount: true,
		createdAt: true,
		finishedAt: true,
		failureCode: true,
	})
	.extend({ id: z.uuid(), itemId: z.uuid() });
export type SafeBatchAttempt = z.infer<typeof safeBatchAttemptSchema>;

export const batchListRequestSchema = z.object({
	status: batchStatusSchema.optional(),
	limit: z.number().int().min(1).max(100).default(25),
	offset: z.number().int().nonnegative().default(0),
});
export const batchItemListRequestSchema = z.object({
	id: z.uuid(),
	limit: z.number().int().min(1).max(100).default(25),
	offset: z.number().int().nonnegative().default(0),
});

export const retiredBatchJobTypes = [
	"processMedia",
	"auto_tagging",
	"extract_ccip_vector",
	"bulk_tagging_parent",
	"bulk_tagging_dispatch",
	"batch_ccip_parent",
	"batch_ccip_dispatch",
	"thumbnail_generation_parent",
	"generate_thumbnail",
] as const;

export class BatchAttemptLostError extends Error {
	constructor() {
		super("Batch dispatch attempt is no longer active");
		this.name = "BatchAttemptLostError";
	}
}
