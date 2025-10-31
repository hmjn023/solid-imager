import type { APIEvent } from "@solidjs/start/server";
import {
  createCharacter,
  getCharacters,
} from "~/infrastructure/api-clients/characters";

/**
 * @swagger
 * /api/charactors:
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
  const characters = await getCharacters();
  return characters;
}

/**
 * @swagger
 * /api/charactors:
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
  const data = await request.json();
  const newCharacter = await createCharacter(data);
  return newCharacter;
}
