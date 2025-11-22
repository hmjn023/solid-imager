import type { APIEvent } from "@solidjs/start/server";
import { SseManager } from "~/infrastructure/jobs/sse-manager";

export function GET({ params, request }: APIEvent) {
  const mediaSourceId = params.mediaSourceId;

  if (!mediaSourceId) {
    return new Response("Media Source ID is required", { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const clientId = SseManager.addClient(mediaSourceId, controller);

      // Send initial connection message
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode("event: connected\ndata: connected\n\n")
      );

      // Clean up on close
      request.signal.addEventListener("abort", () => {
        SseManager.removeClient(mediaSourceId, clientId);
      });
    },
    cancel(_controller) {
      // This might be redundant with the abort signal, but good for safety
      // We can't easily get the clientId here without closure, but the abort handler handles it.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      // biome-ignore lint/style/useNamingConvention: HTTP headers are standard
      Connection: "keep-alive",
    },
  });
}
