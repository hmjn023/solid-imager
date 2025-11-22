import type { APIEvent } from "@solidjs/start/server";
import type { UUID } from "~/domain/shared/schemas";
import { DirectoryService } from "~/application/services/directory-service";

/**
 * @swagger
 * /api/sources/{mediaSourceId}/directories/{directories}:
 *   get:
 *     summary: Retrieve all media and directories under a specific directory
 *     description: Fetches a list of all media files and subdirectories within a specified path under a media source.
 *     tags:
 *       - Directories
 *       - Media
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
 *         description: The complete relative path to the directory (e.g., 'folder1/subfolder2').
 *     responses:
 *       200:
 *         description: A list of media and directories.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DirectoryItem'
 *       400:
 *         description: Invalid source ID or directory path supplied.
 *       404:
 *         description: Media source or directory not found.
 *       500:
 *         description: Internal server error.
 */
export async function GET({ params }: APIEvent) {
  const mediaSourceId = params.mediaSourceId as UUID;
  const directoriesPath = params.directories as string || "";
  const listing = await DirectoryService.listMediaInSubdirectory(mediaSourceId, directoriesPath);
  return listing;
}
