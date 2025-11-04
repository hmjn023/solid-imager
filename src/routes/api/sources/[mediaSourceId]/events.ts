import type { APIEvent } from "@solidjs/start/server";
import type { UUID } from "~/domain/shared/types";
import { startSseMonitoring } from "~/infrastructure/api-clients/events";

/**
 * @swagger
 * /api/sources/{sourceId}/events:
 *   get:
 *     summary: Monitor real-time updates via Server-Sent Events (SSE)
 *     description: Establishes an SSE connection to receive real-time updates on file changes and other events for a specific media source. Only supported for local media sources.
 *     tags:
 *       - Real-time Updates
 *     parameters:
 *       - in: path
 *         name: sourceId
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
export async function GET({ params }: APIEvent) {
  const sourceId = params.sourceId as UUID;
  const result = await startSseMonitoring(sourceId);
  return result;
}
