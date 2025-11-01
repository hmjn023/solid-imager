import type { APIEvent } from "@solidjs/start/server";
import type { UUID } from "~/domain/shared/types";
import { createDirectory } from "~/infrastructure/api-clients/directories";

/**
 * @swagger
 * /api/sources/{sourceId}/directories/create:
 *   post:
 *     summary: Create a new directory
 *     description: Creates a new directory within a specified media source.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateDirectoryRequest'
 *     responses:
 *       201:
 *         description: Directory created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateDirectoryResponse'
 *       400:
 *         description: Invalid input or directory already exists.
 *       500:
 *         description: Internal server error.
 */
export async function POST({ params, request }: APIEvent) {
  const sourceId = params.sourceId as UUID;
  const { path, name } = await request.json(); // パスと名前がボディに含まれていると仮定します。
  const result = await createDirectory(sourceId, path, name);
  return result;
}
