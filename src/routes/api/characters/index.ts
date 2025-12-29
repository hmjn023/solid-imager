import type { APIEvent } from "@solidjs/start/server";
import { ZodError } from "zod";
import { CharacterService } from "~/application/services/character-service";
import { newCharacterSchema } from "~/domain/characters/schemas";
import { logger } from "~/infrastructure/logger";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const _HTTP_BAD_REQUEST = 400;
const _HTTP_INTERNAL_SERVER_ERROR = 500;

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
      status: HTTP_OK,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch characters");
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
      status: HTTP_CREATED,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ err: error }, "Invalid character creation request");
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    logger.error({ err: error }, "Failed to create character");
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
