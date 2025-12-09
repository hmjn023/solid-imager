import type { APIEvent } from "@solidjs/start/server";
import { DirectoryService } from "~/application/services/directory-service";
import type { UUID } from "~/domain/shared/schemas";
import { createDirectoryRequestSchema } from "~/domain/sources/schemas";

/**
 * @swagger
 * /api/sources/{mediaSourceId}/directories/create:
 *   post:
 *     summary: Create a new directory
 *     description: Creates a new directory within a specified media source.
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
  const mediaSourceId = params.mediaSourceId as UUID;
  try {
    const body = await request.json();
    const validatedData = createDirectoryRequestSchema.parse(body);
    const result = await DirectoryService.createDirectory(
      mediaSourceId,
      validatedData
    );
    return new Response(JSON.stringify(result), {
      status: 201,
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
