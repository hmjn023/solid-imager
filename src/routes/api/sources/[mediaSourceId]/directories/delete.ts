import type { APIEvent } from "@solidjs/start/server";
import type { UUID } from "~/domain/shared/types";
import { deleteDirectory } from "~/infrastructure/api-clients/directories";

/**
 * @swagger
 * /api/sources/{mediaSourceId}/directories/delete:
 *   delete:
 *     summary: Delete a directory
 *     description: Deletes a directory within a specified media source.
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
 *             $ref: '#/components/schemas/DeleteDirectoryRequest'
 *     responses:
 *       200:
 *         description: Directory deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteDirectoryResponse'
 *       400:
 *         description: Invalid input or directory not found.
 *       500:
 *         description: Internal server error.
 */
export async function DELETE({ params, request }: APIEvent) {
  const mediaSourceId = params.mediaSourceId as UUID;
  const { path } = await request.json(); // パスがボディに含まれていると仮定します。
  const result = await deleteDirectory(mediaSourceId, path);
  return result;
}
