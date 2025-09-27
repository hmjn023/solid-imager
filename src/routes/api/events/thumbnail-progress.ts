import { type APIEvent } from "solid-start/api";
import { createEffect } from "solid-js";
import { thumbnailJobStats } from "~/services/thumbnail-jobs";

export function GET({ request }: APIEvent) {
  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: string, data: any) => {
        controller.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      createEffect(() => {
        const stats = thumbnailJobStats();

        if (stats.status === "idle") return;

        if (stats.status === "processing") {
          sendEvent("progress", { ...stats });
        }

        if (stats.status === "completed") {
          sendEvent("complete", {
            ...stats,
            summary: {
              success: stats.total - stats.errors.length,
              failed: stats.errors.length,
              failures: stats.errors,
            },
          });
          // We can close the stream after completion, or keep it open for future jobs.
          // For now, let's keep it open.
          // controller.close();
        }
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
