import type { APIEvent } from "@solidjs/start/server";
import {
  clearThumbnailCache,
  startThumbnailGeneration,
} from "~/infrastructure/api-clients/thumbnails";

/**
 * @swagger
 * /api/sources/{sourceId}/thumbnails:
 *   post:
 *     summary: Start manual thumbnail generation
 *     description: Initiates the process of generating thumbnails for all media within a specified source.
 *     tags:
 *       - Thumbnails
 *     parameters:
 *       - in: path
 *         name: sourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source for which to generate thumbnails.
 *     responses:
 *       200:
 *         description: Thumbnail generation started successfully.
 *       400:
 *         description: Invalid source ID supplied.
 *       500:
 *         description: Internal server error.
 */
export async function POST({ params }: APIEvent) {
  const sourceId = params.sourceId;
  const result = await startThumbnailGeneration(sourceId);
  return result;
}

/**
 * @swagger
 * /api/sources/{sourceId}/thumbnails:
 *   delete:
 *     summary: Clear thumbnail cache
 *     description: Clears all generated thumbnail images for a specified media source.
 *     tags:
 *       - Thumbnails
 *     parameters:
 *       - in: path
 *         name: sourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source for which to clear the thumbnail cache.
 *     responses:
 *       200:
 *         description: Thumbnail cache cleared successfully.
 *       400:
 *         description: Invalid source ID supplied.
 *       500:
 *         description: Internal server error.
 */
export async function DELETE({ params }: APIEvent) {
  const sourceId = params.sourceId;
  const result = await clearThumbnailCache(sourceId);
  return result;
}
