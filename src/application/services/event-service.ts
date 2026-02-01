import { EventEmitter } from "node:events";
import type { APIEvent } from "@solidjs/start/server";

// Define event types
type MediaUpdatePayload = {
  mediaId: string;
};

type TaggingBatchStartedPayload = {
  total: number;
  jobId: string;
};

type TaggingJobCompletedPayload = {
  mediaId: string;
  jobId: string;
};

type EventMap = {
  "media:updated": MediaUpdatePayload;
  "tagging:batch-started": TaggingBatchStartedPayload;
  "tagging:job-completed": TaggingJobCompletedPayload;
};

// Strongly-typed EventEmitter
// biome-ignore lint/suspicious/noExplicitAny: Generic event map requires any
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
        const createHandler =
          <K extends keyof EventMap>(eventName: K) =>
          (payload: EventMap[K]) => {
            if (event.request.signal.aborted) {
              return;
            }
            try {
              const data = JSON.stringify({ type: eventName, payload });
              controller.enqueue(`data: ${data}\n\n`);
            } catch (_error) {
              // Controller might be closed or errored, clean up listeners
              Object.keys(this.emitter).forEach((key) => {
                this.emitter.off(key as K, createHandler(key as K));
              });
            }
          };

        const mediaUpdatedHandler = createHandler("media:updated");
        const batchStartedHandler = createHandler("tagging:batch-started");
        const jobCompletedHandler = createHandler("tagging:job-completed");

        this.emitter.on("media:updated", mediaUpdatedHandler);
        this.emitter.on("tagging:batch-started", batchStartedHandler);
        this.emitter.on("tagging:job-completed", jobCompletedHandler);

        // Clean up on client disconnect
        event.request.signal.addEventListener("abort", () => {
          this.emitter.off("media:updated", mediaUpdatedHandler);
          this.emitter.off("tagging:batch-started", batchStartedHandler);
          this.emitter.off("tagging:job-completed", jobCompletedHandler);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        // biome-ignore lint/style/useNamingConvention: HTTP header standard
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
