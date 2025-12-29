import type { APIEvent } from "@solidjs/start/server";
import { MediaSourceService } from "~/application/services/media-source-service";
import type { UUID } from "~/domain/shared/schemas";

/**
 * @swagger
 * /api/sources/{mediaSourceId}/status:
 *   get:
 *     summary: Retrieve the status of a specific media source
 *     description: Fetches the current operational status of a media source, including details like last sync time, number of indexed files, and any ongoing tasks.
 *     tags:
 *       - Media Sources
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
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
  const mediaSourceId = params.mediaSourceId as UUID;
  const status = await MediaSourceService.getStatus(mediaSourceId);
  return status;
}
