import { EventEmitter } from "node:events";

// SSE ハンドラに渡されるリクエストイベントの最小型。
// 旧 @solidjs/start/server の APIEvent 依存を排除するためにローカル定義。
type APIEvent = { request: Request };

// Define event types
type MediaUpdatePayload = {
	mediaId: string;
};

type EventMap = {
	"media:updated": MediaUpdatePayload;
};

// Strongly-typed EventEmitter
class TypedEventEmitter<T extends Record<string, any>> {
	private readonly emitter = new EventEmitter();

	constructor() {
		// Disable listener limit to prevent MaxListenersExceededWarning
		this.emitter.setMaxListeners(0);
	}

	on<K extends keyof T>(eventName: K, listener: (payload: T[K]) => void) {
		this.emitter.on(eventName as string, listener);
	}

	off<K extends keyof T>(eventName: K, listener: (payload: T[K]) => void) {
		this.emitter.off(eventName as string, listener);
	}

	emit<K extends keyof T>(eventName: K, payload: T[K]) {
		this.emitter.emit(eventName as string, payload);
	}
}

/**
 * @deprecated This service is being replaced by SseManager.
 * It is currently only used by the /api/events endpoint which appears to be checked by ManagerPage,
 * but this service only emits 'media:updated' which ManagerPage does not listen to.
 * Use SseManager for all SSE needs.
 */
class EventService {
	private static instance: EventService;

	private readonly emitter = new TypedEventEmitter<EventMap>();

	// Singleton pattern
	static getInstance(): EventService {
		if (!EventService.instance) {
			EventService.instance = new EventService();
		}
		return EventService.instance;
	}

	/**
	 * Creates a Server-Sent Events (SSE) stream.
	 * @param {APIEvent} event - The API event object from the request.
	 * @returns {Response} A response object with the SSE stream.
	 */
	createSseStream(event: APIEvent): Response {
		const stream = new ReadableStream({
			start: (controller) => {
				const handler = (payload: MediaUpdatePayload) => {
					if (event.request.signal.aborted) {
						return;
					}
					try {
						const data = JSON.stringify(payload);
						controller.enqueue(`data: ${data}\n\n`);
					} catch (_error) {
						// Controller might be closed or errored
						// Remove listener to prevent future errors
						this.emitter.off("media:updated", handler);
					}
				};

				this.emitter.on("media:updated", handler);

				// Clean up on client disconnect
				event.request.signal.addEventListener("abort", () => {
					this.emitter.off("media:updated", handler);
					controller.close();
				});
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",

				Connection: "keep-alive",
			},
		});
	}

	/**
	 * Sends an SSE event to all connected clients.
	 * @param {K} eventName - The name of the event.
	 * @param {T[K]} payload - The data to send with the event.
	 */
	sendSseEvent<K extends keyof EventMap>(eventName: K, payload: EventMap[K]) {
		this.emitter.emit(eventName, payload);
	}
}

// Export a singleton instance
export const eventService = EventService.getInstance();
