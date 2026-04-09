import { listen } from "@tauri-apps/api/event";
import { type Accessor, createEffect, onCleanup } from "solid-js";
import { z } from "zod";

const baseEventSchema = z.object({
	mediaSourceId: z.string().optional(),
	filePath: z.string().optional(),
	mediaId: z.string().optional(),
	timestamp: z.string().optional(),
});

const allJobsCompletedSchema = z.object({
	mediaSourceId: z.string().optional(),
	processed: z.number(),
});

const watcherErrorSchema = z.object({
	mediaSourceId: z.string().optional(),
	error: z.string().optional(),
});

type MediaSourceEventsOptions = {
	enabled?: boolean | Accessor<boolean>;
	onMediaAdded?: (data: z.infer<typeof baseEventSchema>) => void;
	onMediaDeleted?: (data: z.infer<typeof baseEventSchema>) => void;
	onMediaChanged?: (data: z.infer<typeof baseEventSchema>) => void;
	onThumbnailGenerated?: (data: z.infer<typeof baseEventSchema>) => void;
	onAllJobsCompleted?: (data: z.infer<typeof allJobsCompletedSchema>) => void;
	onWatcherError?: (data: z.infer<typeof watcherErrorSchema>) => void;
};

export function useMediaSourceEvents(
	mediaSourceId: Accessor<string | undefined>,
	options: MediaSourceEventsOptions = {},
) {
	createEffect(() => {
		const id = mediaSourceId();
		const isEnabled =
			typeof options.enabled === "function"
				? options.enabled()
				: (options.enabled ?? true);
		if (!(id && isEnabled)) {
			return;
		}

		const unlistenPromises = [
			listen("media-added", (event) => {
				const parsed = baseEventSchema.safeParse(event.payload);
				if (parsed.success && parsed.data.mediaSourceId === id) {
					options.onMediaAdded?.(parsed.data);
				}
			}),
			listen("media-deleted", (event) => {
				const parsed = baseEventSchema.safeParse(event.payload);
				if (parsed.success && parsed.data.mediaSourceId === id) {
					options.onMediaDeleted?.(parsed.data);
				}
			}),
			listen("media-changed", (event) => {
				const parsed = baseEventSchema.safeParse(event.payload);
				if (parsed.success && parsed.data.mediaSourceId === id) {
					options.onMediaChanged?.(parsed.data);
				}
			}),
			listen("thumbnail-generated", (event) => {
				const parsed = baseEventSchema.safeParse(event.payload);
				if (parsed.success && parsed.data.mediaSourceId === id) {
					options.onThumbnailGenerated?.(parsed.data);
				}
			}),
			listen("all-jobs-completed", (event) => {
				const parsed = allJobsCompletedSchema.safeParse(event.payload);
				if (parsed.success && parsed.data.mediaSourceId === id) {
					options.onAllJobsCompleted?.(parsed.data);
				}
			}),
			listen("watcher-error", (event) => {
				const parsed = watcherErrorSchema.safeParse(event.payload);
				if (parsed.success && parsed.data.mediaSourceId === id) {
					options.onWatcherError?.(parsed.data);
				}
			}),
		];

		onCleanup(() => {
			void Promise.all(unlistenPromises).then((unlistenFns) => {
				for (const unlisten of unlistenFns) {
					unlisten();
				}
			});
		});
	});
}
