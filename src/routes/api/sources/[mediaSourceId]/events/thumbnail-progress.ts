import { createEffect } from "solid-js";
import type { APIEvent } from "solid-start/api";
import { getThumbnailJobStats } from "~/infrastructure/jobs/thumbnail-jobs";

/**
 * @swagger
 * /api/sources/{mediaSourceId}/events/thumbnail-progress:
 *   get:
 *     summary: Monitor thumbnail generation progress via Server-Sent Events (SSE)
 *     description: Establishes an SSE connection to receive real-time updates on the progress of thumbnail generation for a specific media source.
 *     tags:
 *       - Real-time Updates
 *       - Thumbnails
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source to monitor thumbnail generation for.
 *     responses:
 *       200:
 *         description: An SSE stream providing thumbnail generation progress updates.
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid source ID supplied.
 *       500:
 *         description: Internal server error.
 */
export function GET({ params }: APIEvent) {
  const mediaSourceId = params.mediaSourceId;

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(
          `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        );
      };

      createEffect(() => {
        const stats = getThumbnailJobStats(mediaSourceId);

        if (stats.status === "idle") {
          return;
        }

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
      connection: "keep-alive",
    },
  });
}
