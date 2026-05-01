import {
	allJobsCompletedEventSchema,
	watcherErrorEventSchema,
} from "@solid-imager/core/domain/sources/events";
import type { QueryClient, QueryKey } from "@tanstack/solid-query";
import { type Accessor, createEffect, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
import { toast } from "../toast";

export type RawEventHandler = (eventName: string, payload: unknown) => void;

/**
 * Platform-specific event transport registration.
 * Implementations must subscribe to the relevant events and call `handler`
 * with the raw event name and payload for every incoming event.
 * The returned cleanup function must cancel all subscriptions.
 */
export type RegisterEvents = (handler: RawEventHandler) => () => void;

export type UseSourcesEventsOptions = {
	registerEvents: RegisterEvents;
	sourceIds: Accessor<string[]>;
	queryClient: QueryClient;
	queryKey: QueryKey;
};

export function useSourcesEvents(options: UseSourcesEventsOptions): void {
	createEffect(() => {
		if (isServer) {
			return;
		}

		const cleanup = options.registerEvents((eventName, payload) => {
			const activeSourceIds = new Set(options.sourceIds());

			switch (eventName) {
				case "all-jobs-completed": {
					const result = allJobsCompletedEventSchema.safeParse(payload);
					if (!result.success) {
						console.warn("[useSourcesEvents] Invalid all-jobs-completed payload:", result.error);
						return;
					}
					if (result.data.mediaSourceId && !activeSourceIds.has(result.data.mediaSourceId)) {
						return;
					}
					void options.queryClient.invalidateQueries({
						queryKey: options.queryKey,
					});
					break;
				}
				case "watcher-error": {
					const result = watcherErrorEventSchema.safeParse(payload);
					if (!result.success) {
						console.warn("[useSourcesEvents] Invalid watcher-error payload:", result.error);
						return;
					}
					if (result.data.mediaSourceId && !activeSourceIds.has(result.data.mediaSourceId)) {
						return;
					}
					toast.error(
						`Watcher Error for ${result.data.mediaSourceId?.slice(0, 4) ?? "unknown"}...: ${result.data.error || "Unknown error"}`,
					);
					break;
				}
				default:
					break;
			}
		});

		onCleanup(cleanup);
	});
}
