import type { APIEvent } from "@solidjs/start/server";
import type { UUID } from "~/domain/shared/schemas";

/**
 * Stub implementation for SSE events API
 * This file is kept as a placeholder to avoid breaking build dependencies.
 */

/**
 * @swagger
 * /api/sources/{mediaSourceId}/events:
 *   get:
 *     summary: Monitor real-time updates via Server-Sent Events (SSE)
 *     description: Establishes an SSE connection to receive real-time updates on file changes and other events for a specific media source. Only supported for local media sources.
 *     tags:
 *       - Real-time Updates
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source to monitor.
 *     responses:
 *       200:
 *         description: An SSE stream providing real-time updates.
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid source ID supplied.
 *       404:
 *         description: Media source not found.
 *       500:
 *         description: Internal server error or source type not supported for SSE.
 */
export function GET({ params }: APIEvent) {
  const mediaSourceId = params.mediaSourceId as UUID;

  // Stub response for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ message: `Connected to stub SSE for ${mediaSourceId}` })}\n\n`
        )
      );
    },
    cancel() {
      // cleanup
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      // biome-ignore lint/style/useNamingConvention: Standard HTTP header
      Connection: "keep-alive",
    },
  });
}
