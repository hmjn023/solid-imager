import { type APIEvent } from "solid-start/api";
import { createEffect } from "solid-js";
import { getThumbnailJobStats } from "~/services/thumbnail-jobs";

export function GET({ params, request }: APIEvent) {
  const sourceId = params.sourceId;

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: string, data: any) => {
        controller.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      createEffect(() => {
        const stats = getThumbnailJobStats(sourceId);

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
          // 完了後にストリームを閉じることも、将来のジョブのために開いたままにすることもできます。
          // 現時点では、開いたままにしておきます。
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
