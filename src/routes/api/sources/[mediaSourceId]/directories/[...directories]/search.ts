import type { APIEvent } from "@solidjs/start/server";
import { MediaService } from "~/application/services/media-service";
import type { UUID } from "~/domain/shared/schemas";

/**
 * @swagger
 * /api/sources/{mediaSourceId}/directories/{directories}/search:
 *   get:
 *     summary: Search for media within a specific subdirectory
 *     description: Searches for media files within a specified subdirectory of a media source, based on various criteria like tags, metadata, categories, IPs, and characters. Supports pagination.
 *     tags:
 *       - Directories
 *       - Media
 *       - Search
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source.
 *       - in: path
 *         name: directories
 *         required: true
 *         schema:
 *           type: string
 *         description: The complete relative path to the directory to search within (e.g., 'folder1/subfolder2').
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
 *       404:
 *         description: Media source or directory not found.
 *       500:
 *         description: Internal server error.
 */
export async function GET({ params, request }: APIEvent) {
  const mediaSourceId = params.mediaSourceId as UUID;
  const directoriesParam = params.directories;
  const directoriesPath = Array.isArray(directoriesParam)
    ? directoriesParam.join("/")
    : directoriesParam;
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());
  const result = await MediaService.searchMediaInDirectory(
    mediaSourceId,
    directoriesPath,
    {
      query: queryParams.filename as string,
      tags: (() => {
        if (!queryParams.tags) {
          return;
        }
        return Array.isArray(queryParams.tags)
          ? queryParams.tags
          : [queryParams.tags];
      })(),
    }
  );
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
