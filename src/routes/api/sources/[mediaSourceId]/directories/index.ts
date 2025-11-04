import type { APIEvent } from "@solidjs/start/server";
import type { UUID } from "~/domain/shared/types";
import { getDirectoryListing } from "~/infrastructure/api-clients/directories";

/**
 * @swagger
 * /api/sources/{sourceId}/directories:
 *   get:
 *     summary: Retrieve a list of directories within a media source
 *     description: Fetches a hierarchical listing of directories and their contents for a given media source. Can be filtered by a parent path.
 *     tags:
 *       - Directories
 *     parameters:
 *       - in: path
 *         name: sourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source.
 *       - in: query
 *         name: path
 *         schema:
 *           type: string
 *         description: Optional. The path to the parent directory to list. If not provided, lists the root directories.
 *     responses:
 *       200:
 *         description: A list of directories and media within the specified path.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DirectoryItem'
 *       400:
 *         description: Invalid source ID supplied.
 *       404:
 *         description: Media source or directory not found.
 *       500:
 *         description: Internal server error.
 */
export async function GET({ params, request }: APIEvent) {
  const sourceId = params.sourceId as UUID;
  const url = new URL(request.url);
  const path = url.searchParams.get("path") || undefined; // ?path=parent を処理します。
  const listing = await getDirectoryListing(sourceId, path);
  return listing;
}
