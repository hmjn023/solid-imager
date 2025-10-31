import type { APIEvent } from "@solidjs/start/server";
import type { UUID } from "~/domain/shared/types";
import { getMediaSourceStatus } from "~/infrastructure/api-clients/sources";

/**
 * @swagger
 * /api/sources/{sourceId}/status:
 *   get:
 *     summary: Retrieve the status of a specific media source
 *     description: Fetches the current operational status of a media source, including details like last sync time, number of indexed files, and any ongoing tasks.
 *     tags:
 *       - Media Sources
 *     parameters:
 *       - in: path
 *         name: sourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source to retrieve status for.
 *     responses:
 *       200:
 *         description: The status of the media source.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaSourceStatus'
 *       400:
 *         description: Invalid source ID supplied.
 *       404:
 *         description: Media source not found.
 *       500:
 *         description: Internal server error.
 */
export async function GET({ params }: APIEvent) {
  const sourceId = params.sourceId as UUID;
  const status = await getMediaSourceStatus(sourceId);
  return status;
}
