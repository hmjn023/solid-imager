import { z } from "zod";
import {
	downloadItemSchema,
	mediaMetadataContextSchema,
} from "../media/schemas";

export const downloadInputSchema = downloadItemSchema.extend({
	targetUrl: z.url().refine((value) => {
		const protocol = new URL(value).protocol;
		return protocol === "http:" || protocol === "https:";
	}, "Only HTTP(S) download URLs are supported"),
	importRequestId: z.uuid().optional(),
});
export type DownloadInput = z.infer<typeof downloadInputSchema>;
export const downloadRegistrationEntrySchema = z.object({
	stagedPath: z.string().min(1),
	filePath: z.string().min(1),
	fileSize: z.number().int().nonnegative(),
	modifiedAt: z.coerce.date(),
	published: z.boolean().default(false),
	mediaId: z.uuid().optional(),
	context: mediaMetadataContextSchema.extend({
		sourceUrls: z.array(z.url()).min(1),
	}),
});
export const downloadRegistrationCheckpointSchema = z.object({
	version: z.literal(1),
	mediaSourceId: z.string().min(1),
	sourcePath: z.string().min(1),
	stagingDirectory: z.string().min(1),
	entries: z.array(downloadRegistrationEntrySchema).min(1),
});
export type DownloadRegistrationEntry = z.infer<
	typeof downloadRegistrationEntrySchema
>;
export type DownloadRegistrationCheckpoint = z.infer<
	typeof downloadRegistrationCheckpointSchema
>;
export const downloadRunStatusSchema = z.enum([
	"pending",
	"in_progress",
	"completed",
	"failed",
	"cancelled",
	"blocked",
	"superseded",
]);
export type DownloadRunStatus = z.infer<typeof downloadRunStatusSchema>;
export const downloadBlockedReasonSchema = z.enum([
	"invalid_input",
	"invalid_checkpoint",
	"invalid_source",
	"legacy_parent",
	"ambiguous_registration",
]);
export type DownloadBlockedReason = z.infer<typeof downloadBlockedReasonSchema>;
export const downloadResultSchema = z.object({ mediaIds: z.array(z.uuid()) });
export type DownloadResult = z.infer<typeof downloadResultSchema>;
export const downloadRunSchema = z.object({
	id: z.uuid(),
	mediaSourceId: z.uuid().nullable(),
	sourcePath: z.string().nullable(),
	input: downloadInputSchema.nullable(),
	requestKey: z.string(),
	importRequestId: z.uuid().nullable(),
	status: downloadRunStatusSchema,
	canonicalId: z.uuid().nullable(),
	blockedReason: downloadBlockedReasonSchema.nullable(),
	attemptCount: z.number().int().nonnegative(),
	maxAttempts: z.number().int().positive(),
	leaseToken: z.uuid().nullable(),
	leaseExpiresAt: z.coerce.date().nullable(),
	nextRunAt: z.coerce.date(),
	checkpoint: downloadRegistrationCheckpointSchema.nullable(),
	result: downloadResultSchema.nullable(),
	error: z.string().nullable(),
	parentId: z.uuid().nullable(),
	cancelRequestedAt: z.coerce.date().nullable(),
	cancelledAt: z.coerce.date().nullable(),
	startedAt: z.coerce.date().nullable(),
	finishedAt: z.coerce.date().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type DownloadRun = z.infer<typeof downloadRunSchema>;
export const downloadClaimSchema = downloadRunSchema.extend({
	status: z.literal("in_progress"),
	input: downloadInputSchema,
	leaseToken: z.uuid(),
	leaseExpiresAt: z.coerce.date(),
});
export type DownloadClaim = z.infer<typeof downloadClaimSchema>;
/** No authentication, local paths, checkpoint, lease token or raw failure in public responses. */
export const safeDownloadRunSchema = downloadRunSchema
	.pick({
		id: true,
		mediaSourceId: true,
		status: true,
		canonicalId: true,
		blockedReason: true,
		attemptCount: true,
		maxAttempts: true,
		nextRunAt: true,
		cancelRequestedAt: true,
		cancelledAt: true,
		startedAt: true,
		finishedAt: true,
		createdAt: true,
		updatedAt: true,
	})
	.extend({
		targetUrl: z.url().nullable(),
		mediaIds: z.array(z.uuid()),
		error: z.string().nullable(),
	});
export type SafeDownloadRun = z.infer<typeof safeDownloadRunSchema>;
export const downloadListRequestSchema = z.object({
	status: downloadRunStatusSchema.optional(),
	mediaSourceId: z.uuid().optional(),
	limit: z.number().int().min(1).max(200).default(50),
	offset: z.number().int().nonnegative().default(0),
});
export type DownloadListRequest = z.infer<typeof downloadListRequestSchema>;
export const downloadListResponseSchema = z.object({
	items: z.array(safeDownloadRunSchema),
	total: z.number().int().nonnegative(),
});
export const downloadCutoverReportSchema = z.object({
	migrated: z.number().int().nonnegative(),
	blocked: z.number().int().nonnegative(),
	aliases: z.number().int().nonnegative(),
});
export type DownloadCutoverReport = z.infer<typeof downloadCutoverReportSchema>;
export class DownloadAttemptLostError extends Error {
	constructor() {
		super("Download lease is no longer active");
		this.name = "DownloadAttemptLostError";
	}
}
export class DownloadCancelledError extends Error {
	constructor() {
		super("Download cancellation requested");
		this.name = "DownloadCancelledError";
	}
}
