import type {
	JobEventData,
	JobEventName,
	SourceEventData,
	SourceEventName,
} from "@solid-imager/core/events";
import { logger } from "~/infrastructure/logger";
import { RealtimeEventBus } from "./realtime-event-bus";

/** Notifications are hints about persisted work; subscribers cannot change its result. */
export function notifyJob<TName extends JobEventName>(
	event: TName,
	data: JobEventData<TName>,
): void {
	try {
		RealtimeEventBus.publishJob(event, data);
	} catch (error) {
		logger.error({ err: error, event }, "Failed to publish job notification");
	}
}

/** A thumbnail or media update remains successful when an observer is unavailable. */
export function notifySource<TName extends SourceEventName>(
	sourceId: string,
	event: TName,
	data: SourceEventData<TName>,
): void {
	try {
		RealtimeEventBus.publishSource(sourceId, event, data);
	} catch (error) {
		logger.error(
			{ err: error, sourceId, event },
			"Failed to publish source notification",
		);
	}
}
