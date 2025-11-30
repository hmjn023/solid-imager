import type { APIEvent } from "@solidjs/start/server";
import { ZodError } from "zod";
import { CharacterService } from "~/application/services/character-service";
import { newCharacterSchema } from "~/domain/characters/schemas";

/**
 * @swagger
 * /api/characters:
 *   get:
 *     summary: Retrieve all characters
 *     description: Fetches a list of all configured characters.
 *     tags:
 *       - Characters
 *     responses:
 *       200:
 *         description: A list of characters.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Character'
 *       500:
 *         description: Internal server error.
 */
export async function GET() {
  try {
    const characters = await CharacterService.getAllCharacters();
    return new Response(JSON.stringify(characters), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * @swagger
 * /api/characters:
 *   post:
 *     summary: Create a new character
 *     description: Creates a new character with the provided data.
 *     tags:
 *       - Characters
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewCharacter'
 *     responses:
 *       201:
 *         description: The created character.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Character'
 *       400:
 *         description: Invalid input.
 *       500:
 *         description: Internal server error.
 */
export async function POST({ request }: APIEvent) {
  try {
    const data = await request.json();
    const validatedData = newCharacterSchema.parse(data);
    const newCharacter = await CharacterService.createCharacter(validatedData);
    return new Response(JSON.stringify(newCharacter), {
      status: 201,
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
