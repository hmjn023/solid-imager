import type { APIEvent } from "@solidjs/start/server";
import { DirectoryService } from "~/application/services/directory-service";
import type { UUID } from "~/domain/shared/schemas";

/**
 * @swagger
 * /api/sources/{mediaSourceId}/directories:
 *   get:
 *     summary: Retrieve a list of directories within a media source
 *     description: Fetches a hierarchical listing of directories and their contents for a given media source. Can be filtered by a parent path.
 *     tags:
 *       - Directories
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
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
  const mediaSourceId = params.mediaSourceId as UUID;
  const url = new URL(request.url);
  const path = url.searchParams.get("path") || ""; // Default to empty string for root
  const listing = await DirectoryService.listMediaInSubdirectory(
    mediaSourceId,
    path
  );
  return listing;
}
