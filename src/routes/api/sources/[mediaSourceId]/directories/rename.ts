import type { APIEvent } from "@solidjs/start/server";
import type { UUID } from "~/domain/shared/schemas";
import { renameDirectory } from "~/infrastructure/api-clients/directories";

/**
 * @swagger
 * /api/sources/{mediaSourceId}/directories/rename:
 *   put:
 *     summary: Rename a directory
 *     description: Renames an existing directory within a specified media source.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RenameDirectoryRequest'
 *     responses:
 *       200:
 *         description: Directory renamed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RenameDirectoryResponse'
 *       400:
 *         description: Invalid input or directory not found.
 *       500:
 *         description: Internal server error.
 */
export async function PUT({ params, request }: APIEvent) {
  const mediaSourceId = params.mediaSourceId as UUID;
  const { oldPath, newPath } = await request.json(); // oldPathとnewPathがボディに含まれていると仮定します。
  const result = await renameDirectory(mediaSourceId, oldPath, newPath);
  return result;
}
