import type { APIEvent } from "@solidjs/start/server";
import { ZodError, z } from "zod";
import { CharacterService } from "~/application/services/character-service";
import { updateCharacterSchema } from "~/domain/characters/schemas";

// パスパラメータ 'id' のスキーマ
const IdParamSchema = z.object({
  id: z.string().uuid(), // UUID v4 を想定します。
});
export type IdParam = z.infer<typeof IdParamSchema>;

/**
 * @swagger
 * /api/characters/{id}:
 *   get:
 *     summary: Retrieve a specific character
 *     description: Fetches details of a character by its ID.
 *     tags:
 *       - Characters
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the character to retrieve.
 *     responses:
 *       200:
 *         description: Details of the character.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Character'
 *       400:
 *         description: Invalid ID supplied.
 *       404:
 *         description: Character not found.
 *       500:
 *         description: Internal server error.
 */
export async function GET({ params }: APIEvent) {
  try {
    const parsedParams = IdParamSchema.parse(params);
    const { id } = parsedParams;
    const character = await CharacterService.getCharacterDetails(id);
    return new Response(JSON.stringify(character), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * @swagger
 * /api/characters/{id}:
 *   patch:
 *     summary: Update a specific character
 *     description: Updates an existing character with the provided data.
 *     tags:
 *       - Characters
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the character to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCharacter'
 *     responses:
 *       200:
 *         description: The updated character.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Character'
 *       400:
 *         description: Invalid ID or invalid input.
 *       404:
 *         description: Character not found.
 *       500:
 *         description: Internal server error.
 */
export async function PATCH({ params, request }: APIEvent) {
  try {
    const parsedParams = IdParamSchema.parse(params);
    const { id } = parsedParams;

    const body = await request.json();
    const validatedBody = updateCharacterSchema.parse(body);

    const updatedCharacter = await CharacterService.updateCharacter(
      id,
      validatedBody
    );
    return new Response(JSON.stringify(updatedCharacter), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * @swagger
 * /api/characters/{id}:
 *   delete:
 *     summary: Delete a specific character
 *     description: Deletes a character by its ID.
 *     tags:
 *       - Characters
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the character to delete.
 *     responses:
 *       200:
 *         description: Character successfully deleted.
 *       400:
 *         description: Invalid ID supplied.
 *       404:
 *         description: Character not found.
 *       500:
 *         description: Internal server error.
 */
export async function DELETE({ params }: APIEvent) {
  try {
    const parsedParams = IdParamSchema.parse(params);
    const { id } = parsedParams;
    const result = await CharacterService.deleteCharacter(id);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
