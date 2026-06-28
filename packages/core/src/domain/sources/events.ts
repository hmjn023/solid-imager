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
	timestamp: z.string().optional(),
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

export const downloadErrorEventSchema = z.object({
	url: z.string(),
	error: z.string(),
});
export type DownloadErrorEvent = z.infer<typeof downloadErrorEventSchema>;

export const importRequestCreatedEventSchema = z.object({
	count: z.number().int().min(0),
});
export type ImportRequestCreatedEvent = z.infer<
	typeof importRequestCreatedEventSchema
>;

export const importRequestProcessedEventSchema = z.object({
	processedCount: z.number().int().min(0),
});
export type ImportRequestProcessedEvent = z.infer<
	typeof importRequestProcessedEventSchema
>;

export const importRequestDeletedEventSchema = z.object({
	jobIds: z.array(z.string().uuid()),
});
export type ImportRequestDeletedEvent = z.infer<
	typeof importRequestDeletedEventSchema
>;

export const sourceEventSchema = z.discriminatedUnion("event", [
	z.object({
		mediaSourceId: z.string(),
		event: z.literal("media-added"),
		data: mediaAddedEventSchema,
	}),
	z.object({
		mediaSourceId: z.string(),
		event: z.literal("media-deleted"),
		data: mediaDeletedEventSchema,
	}),
	z.object({
		mediaSourceId: z.string(),
		event: z.literal("media-changed"),
		data: mediaChangedEventSchema,
	}),
	z.object({
		mediaSourceId: z.string(),
		event: z.literal("media-copied"),
		data: mediaCopiedEventSchema,
	}),
	z.object({
		mediaSourceId: z.string(),
		event: z.literal("media-moved"),
		data: mediaMovedEventSchema,
	}),
	z.object({
		mediaSourceId: z.string(),
		event: z.literal("thumbnail-generated"),
		data: thumbnailGeneratedEventSchema,
	}),
	z.object({
		mediaSourceId: z.string(),
		event: z.literal("all-jobs-completed"),
		data: allJobsCompletedEventSchema,
	}),
	z.object({
		mediaSourceId: z.string(),
		event: z.literal("watcher-error"),
		data: watcherErrorEventSchema,
	}),
	z.object({
		mediaSourceId: z.string(),
		event: z.literal("download-error"),
		data: downloadErrorEventSchema,
	}),
]);
export type SourceEvent = z.infer<typeof sourceEventSchema>;
export type SourceEventName = SourceEvent["event"];
export type SourceEventData<TName extends SourceEventName> = Extract<
	SourceEvent,
	{ event: TName }
>["data"];
export type SourceEventPublisher = <TName extends SourceEventName>(
	mediaSourceId: string,
	eventType: TName,
	data: SourceEventData<TName>,
) => void;
export type SourceEventCommand = {
	[TName in SourceEventName]: {
		event: TName;
		payload: SourceEventData<TName>;
	};
}[SourceEventName];

export const jobEventSchema = z.discriminatedUnion("event", [
	z.object({ event: z.literal("job-progress"), data: jobProgressEventSchema }),
	z.object({
		event: z.literal("job-completed"),
		data: jobCompletedEventSchema,
	}),
	z.object({ event: z.literal("job-failed"), data: jobFailedEventSchema }),
]);
export type JobEvent = z.infer<typeof jobEventSchema>;
export type JobEventName = JobEvent["event"];
export type JobEventData<TName extends JobEventName> = Extract<
	JobEvent,
	{ event: TName }
>["data"];

export const importEventSchema = z.discriminatedUnion("event", [
	z.object({
		event: z.literal("import-request:created"),
		data: importRequestCreatedEventSchema,
	}),
	z.object({
		event: z.literal("import-request:processed"),
		data: importRequestProcessedEventSchema,
	}),
	z.object({
		event: z.literal("import-request:deleted"),
		data: importRequestDeletedEventSchema,
	}),
]);
export type ImportEvent = z.infer<typeof importEventSchema>;
export type ImportEventName = ImportEvent["event"];
export type ImportEventData<TName extends ImportEventName> = Extract<
	ImportEvent,
	{ event: TName }
>["data"];
