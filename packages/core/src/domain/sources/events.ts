import { z } from "zod";

const sourceScopedEventSchema = z.object({
	mediaSourceId: z.string().uuid().optional(),
	filePath: z.string(),
	mediaId: z.string().uuid().optional(),
	timestamp: z.string().optional(),
});

export const mediaAddedEventSchema = sourceScopedEventSchema;
export type MediaAddedEvent = z.infer<typeof mediaAddedEventSchema>;

export const mediaDeletedEventSchema = sourceScopedEventSchema;
export type MediaDeletedEvent = z.infer<typeof mediaDeletedEventSchema>;

export const mediaChangedEventSchema = sourceScopedEventSchema;
export type MediaChangedEvent = z.infer<typeof mediaChangedEventSchema>;

export const mediaCopiedEventSchema = z.object({
	sourceId: z.string().uuid().optional(),
	targetId: z.string().uuid().optional(),
	sourceMediaId: z.string().uuid().optional(),
	mediaId: z.string().uuid().optional(),
	media: z.unknown().optional(),
	timestamp: z.string().optional(),
});
export type MediaCopiedEvent = z.infer<typeof mediaCopiedEventSchema>;

export const mediaMovedEventSchema = z.object({
	type: z.enum(["source", "target"]),
	sourceId: z.string().uuid().optional(),
	targetId: z.string().uuid().optional(),
	mediaId: z.string().uuid().optional(),
	media: z.unknown().optional(),
	timestamp: z.string().optional(),
});
export type MediaMovedEvent = z.infer<typeof mediaMovedEventSchema>;

export const thumbnailGeneratedEventSchema = z.object({
	mediaSourceId: z.string().uuid().optional(),
	mediaId: z.string().uuid(),
	filePath: z.string().optional(),
	timestamp: z.string().optional(),
});
export type ThumbnailGeneratedEvent = z.infer<
	typeof thumbnailGeneratedEventSchema
>;

export const allJobsCompletedEventSchema = z.object({
	mediaSourceId: z.string().uuid().optional(),
	processed: z.number(),
});
export type AllJobsCompletedEvent = z.infer<typeof allJobsCompletedEventSchema>;

export const watcherErrorEventSchema = z.object({
	mediaSourceId: z.string().uuid().optional(),
	error: z.string().optional(),
});
export type WatcherErrorEvent = z.infer<typeof watcherErrorEventSchema>;

export const jobProgressEventSchema = z.object({
	jobId: z.string().optional(),
	processed: z.number(),
	total: z.number(),
});
export type JobProgressEvent = z.infer<typeof jobProgressEventSchema>;

export const jobCompletedEventSchema = z.object({
	jobId: z.string().optional(),
	message: z.string().optional(),
});
export type JobCompletedEvent = z.infer<typeof jobCompletedEventSchema>;

export const jobFailedEventSchema = z.object({
	jobId: z.string().optional(),
	error: z.string().optional(),
});
export type JobFailedEvent = z.infer<typeof jobFailedEventSchema>;
