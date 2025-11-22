import type { APIEvent } from "@solidjs/start/server";
import { DirectoryService } from "~/application/services/directory-service";
import type { UUID } from "~/domain/shared/schemas";
import { updateDirectoryRequestSchema } from "~/domain/sources/schemas";

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
  try {
    const body = await request.json();
    const validatedData = updateDirectoryRequestSchema.parse(body);
    const result = await DirectoryService.updateDirectory(
      mediaSourceId,
      validatedData
    );
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "ZodError") {
      return new Response(
        JSON.stringify({ error: JSON.parse(error.message) }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
