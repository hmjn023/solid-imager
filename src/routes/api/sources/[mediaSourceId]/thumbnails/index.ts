import type { APIEvent } from "@solidjs/start/server";

/**
 * Stub implementation for thumbnails API
 * This file is kept as a placeholder to avoid breaking build dependencies.
 */

/**
 * @swagger
 * /api/sources/{mediaSourceId}/thumbnails:
 *   post:
 *     summary: Start manual thumbnail generation
 *     description: Initiates the process of generating thumbnails for all media within a specified source.
 *     tags:
 *       - Thumbnails
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
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
export function POST({ params }: APIEvent) {
  const mediaSourceId = params.mediaSourceId;
  // Stub: pretend to start generation
  return {
    message: `Started thumbnail generation for ${mediaSourceId} (Stub)`,
  };
}

/**
 * @swagger
 * /api/sources/{mediaSourceId}/thumbnails:
 *   delete:
 *     summary: Clear thumbnail cache
 *     description: Clears all generated thumbnail images for a specified media source.
 *     tags:
 *       - Thumbnails
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
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
export function DELETE({ params }: APIEvent) {
  const mediaSourceId = params.mediaSourceId;
  // Stub: pretend to clear cache
  return { message: `Cleared thumbnail cache for ${mediaSourceId} (Stub)` };
}
