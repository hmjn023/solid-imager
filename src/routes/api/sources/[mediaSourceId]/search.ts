import type { APIEvent } from "@solidjs/start/server";
import type { UUID } from "~/domain/shared/schemas";
import { searchMedia } from "~/infrastructure/api-clients/media";

/**
 * @swagger
 * /api/sources/{mediaSourceId}/search:
 *   get:
 *     summary: Search for media within a specific media source
 *     description: Searches for media files within a given media source based on various criteria like tags, metadata, categories, IPs, and characters. Supports pagination.
 *     tags:
 *       - Media
 *       - Search
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source to search within.
 *       - in: query
 *         name: tags
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: List of tags to filter by (AND condition).
 *       - in: query
 *         name: filename
 *         schema:
 *           type: string
 *         description: Partial match for filename.
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for media creation date range.
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for media creation date range.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of items per page for pagination.
 *     responses:
 *       200:
 *         description: A list of matching media files and pagination information.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 media:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Media'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     totalItems:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     currentPage:
 *                       type: integer
 *                     itemsPerPage:
 *                       type: integer
 *       400:
 *         description: Invalid source ID or search parameters.
 *       500:
 *         description: Internal server error.
 */
export async function GET({ params, request }: APIEvent) {
  const mediaSourceId = params.mediaSourceId as UUID;
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());
  const result = await searchMedia(mediaSourceId, queryParams);
  return result;
}
