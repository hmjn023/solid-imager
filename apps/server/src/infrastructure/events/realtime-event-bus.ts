import { EventEmitter } from "node:events";
import {
	type ImportEvent,
	type ImportEventData,
	type ImportEventName,
	importEventSchema,
	type JobEvent,
	type JobEventData,
	type JobEventName,
	jobEventSchema,
	type SourceEvent,
	type SourceEventCommand,
	type SourceEventData,
	type SourceEventName,
	sourceEventSchema,
} from "@solid-imager/core/domain/sources/events";

const JOB_EVENTS_CHANNEL = "jobs";
const IMPORT_EVENTS_CHANNEL = "imports";
const ALL_SOURCE_EVENTS_CHANNEL = "sources:*";
const DEFAULT_MAX_LISTENERS = 100;
const RECENT_JOB_EVENT_LIMIT = 100;
const RECENT_JOB_EVENT_TTL_MS = 60_000;

type RecentJobEvent = {
	event: JobEvent;
	publishedAt: number;
};

const globalEvents = globalThis as typeof globalThis & {
	__REALTIME_EVENT_EMITTER__?: EventEmitter;
	__RECENT_JOB_EVENTS__?: RecentJobEvent[];
};

if (!globalEvents.__REALTIME_EVENT_EMITTER__) {
	const emitter = new EventEmitter();
	emitter.setMaxListeners(DEFAULT_MAX_LISTENERS);
	globalEvents.__REALTIME_EVENT_EMITTER__ = emitter;
}

const emitter = globalEvents.__REALTIME_EVENT_EMITTER__;
const recentJobEvents: RecentJobEvent[] =
	globalEvents.__RECENT_JOB_EVENTS__ ?? [];
globalEvents.__RECENT_JOB_EVENTS__ = recentJobEvents;

function pruneRecentJobEvents(now: number): void {
	const minimumPublishedAt = now - RECENT_JOB_EVENT_TTL_MS;
	while (
		recentJobEvents.length > 0 &&
		recentJobEvents[0].publishedAt < minimumPublishedAt
	) {
		recentJobEvents.shift();
	}
}

function rememberJobEvent(event: JobEvent): void {
	const now = Date.now();
	pruneRecentJobEvents(now);
	recentJobEvents.push({ event, publishedAt: now });
	if (recentJobEvents.length > RECENT_JOB_EVENT_LIMIT) {
		recentJobEvents.splice(0, recentJobEvents.length - RECENT_JOB_EVENT_LIMIT);
	}
}

function publish(channel: string, event: SourceEvent | JobEvent | ImportEvent) {
	emitter.emit(channel, event);
}

function subscribe<TEvent>(
	channel: string,
	listener: (event: TEvent) => void,
): () => void {
	emitter.on(channel, listener);
	return () => {
		emitter.off(channel, listener);
	};
}

export const RealtimeEventBus = {
	publishSource<TName extends SourceEventName>(
		mediaSourceId: string,
		eventType: TName,
		data: SourceEventData<TName>,
	): void {
		const event = sourceEventSchema.parse({ event: eventType, data });
		publish(`source:${mediaSourceId}`, event);
		publish(ALL_SOURCE_EVENTS_CHANNEL, event);
	},

	publishSourceCommand(
		mediaSourceId: string,
		command: SourceEventCommand,
	): void {
		const event = sourceEventSchema.parse({
			event: command.event,
			data: command.payload,
		});
		publish(`source:${mediaSourceId}`, event);
		publish(ALL_SOURCE_EVENTS_CHANNEL, event);
	},

	publishJob<TName extends JobEventName>(
		eventType: TName,
		data: JobEventData<TName>,
	): void {
		const event = jobEventSchema.parse({ event: eventType, data });
		rememberJobEvent(event);
		publish(JOB_EVENTS_CHANNEL, event);
	},

	publishImport<TName extends ImportEventName>(
		eventType: TName,
		data: ImportEventData<TName>,
	): void {
		publish(
			IMPORT_EVENTS_CHANNEL,
			importEventSchema.parse({ event: eventType, data }),
		);
	},

	subscribeToSource(
		mediaSourceId: string | "*",
		listener: (event: SourceEvent) => void,
	): () => void {
		return subscribe(
			mediaSourceId === "*"
				? ALL_SOURCE_EVENTS_CHANNEL
				: `source:${mediaSourceId}`,
			listener,
		);
	},

	subscribeToJobs(listener: (event: JobEvent) => void): () => void {
		const deliveredEvents = new Set<JobEvent>();
		const deliver = (event: JobEvent) => {
			if (deliveredEvents.has(event)) {
				return;
			}
			deliveredEvents.add(event);
			listener(event);
		};
		const unsubscribe = subscribe(JOB_EVENTS_CHANNEL, deliver);
		pruneRecentJobEvents(Date.now());
		for (const { event } of recentJobEvents) {
			deliver(event);
		}
		return unsubscribe;
	},

	subscribeToImports(listener: (event: ImportEvent) => void): () => void {
		return subscribe(IMPORT_EVENTS_CHANNEL, listener);
	},

	notifyMediaCopied(sourceId: string, targetId: string, media: unknown): void {
		this.publishSource(targetId, "media-copied", {
			sourceId,
			media,
			timestamp: new Date().toISOString(),
		});
	},

	notifyMediaMoved(
		sourceId: string,
		targetId: string,
		mediaId: string,
		media: unknown,
	): void {
		this.publishSource(sourceId, "media-moved", {
			type: "source",
			mediaId,
			targetId,
			timestamp: new Date().toISOString(),
		});
		this.publishSource(targetId, "media-moved", {
			type: "target",
			media,
			sourceId,
			timestamp: new Date().toISOString(),
		});
	},
};
