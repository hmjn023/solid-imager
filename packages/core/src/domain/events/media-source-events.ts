import { z } from "zod";

export const MediaAddedEventSchema = z.object({
	filePath: z.string(),
	mediaId: z.string().optional(),
	timestamp: z.string().optional(),
});
export type MediaAddedEvent = z.infer<typeof MediaAddedEventSchema>;

export const MediaDeletedEventSchema = z.object({
	filePath: z.string(),
	timestamp: z.string().optional(),
});
export type MediaDeletedEvent = z.infer<typeof MediaDeletedEventSchema>;

export const MediaChangedEventSchema = z.object({
	filePath: z.string(),
	mediaId: z.string().optional(),
	timestamp: z.string().optional(),
});
export type MediaChangedEvent = z.infer<typeof MediaChangedEventSchema>;

export const MediaCopiedEventSchema = z.object({
	sourceId: z.string(),
	media: z.unknown(),
	timestamp: z.string(),
});
export type MediaCopiedEvent = z.infer<typeof MediaCopiedEventSchema>;

export const MediaMovedEventSchema = z.object({
	type: z.enum(["source", "target"]),
	mediaId: z.string().optional(),
	targetId: z.string().optional(),
	media: z.unknown().optional(),
	sourceId: z.string().optional(),
	timestamp: z.string(),
});
export type MediaMovedEvent = z.infer<typeof MediaMovedEventSchema>;

export const ThumbnailGeneratedEventSchema = z.object({
	mediaId: z.string(),
});
export type ThumbnailGeneratedEvent = z.infer<
	typeof ThumbnailGeneratedEventSchema
>;

export const AllJobsCompletedEventSchema = z.object({
	processed: z.number(),
});
export type AllJobsCompletedEvent = z.infer<typeof AllJobsCompletedEventSchema>;

export const WatcherErrorEventSchema = z.object({
	error: z.string().optional(),
});
export type WatcherErrorEvent = z.infer<typeof WatcherErrorEventSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidMediaAdded(data: unknown): data is MediaAddedEvent {
	return isRecord(data) && typeof data.filePath === "string";
}

export function isValidMediaDeleted(data: unknown): data is MediaDeletedEvent {
	return isRecord(data) && typeof data.filePath === "string";
}

export function isValidMediaChanged(data: unknown): data is MediaChangedEvent {
	return isRecord(data) && typeof data.filePath === "string";
}

export function isValidMediaCopied(data: unknown): data is MediaCopiedEvent {
	return (
		isRecord(data) &&
		typeof data.sourceId === "string" &&
		typeof data.timestamp === "string"
	);
}

export function isValidMediaMoved(data: unknown): data is MediaMovedEvent {
	return (
		isRecord(data) &&
		(data.type === "source" || data.type === "target") &&
		typeof data.timestamp === "string"
	);
}

export function isValidThumbnailGenerated(
	data: unknown,
): data is ThumbnailGeneratedEvent {
	return isRecord(data) && typeof data.mediaId === "string";
}

export function isValidAllJobsCompleted(
	data: unknown,
): data is AllJobsCompletedEvent {
	return isRecord(data) && typeof data.processed === "number";
}

export function isValidWatcherError(data: unknown): data is WatcherErrorEvent {
	return isRecord(data) && typeof data.error === "string";
}
