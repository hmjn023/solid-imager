import type { APIEvent } from "@solidjs/start/server";
import { ZodError, z } from "zod";
import { CharacterService } from "~/application/services/character-service";
import { NotFoundError } from "~/infrastructure/db/errors";

const MediaParamsSchema = z.object({
  mediaSourceId: z.uuid({ version: "v4" }),
  mediaId: z.uuid({ version: "v4" }),
});

const CharacterBodySchema = z.object({
  characterId: z.number(),
});

/**
 * @swagger
 * /api/sources/{mediaSourceId}/{mediaId}/characters:
 *   get:
 *     summary: Retrieve characters associated with a media
 *     description: Fetches a list of characters linked to a specific media file.
 *     tags:
 *       - Media
 *       - Characters
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source.
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media file.
 *     responses:
 *       200:
 *         description: A list of characters associated with the media.
 *       400:
 *         description: Invalid source ID or media ID supplied.
 *       404:
 *         description: Media not found.
 *       500:
 *         description: Internal server error.
 */
export async function GET({ params }: APIEvent) {
  try {
    const { mediaId } = MediaParamsSchema.parse(params);
    const characters = await CharacterService.getCharactersForMedia(mediaId);
    return new Response(JSON.stringify(characters), {
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
 * /api/sources/{mediaSourceId}/{mediaId}/characters:
 *   post:
 *     summary: Add a character to a media
 *     description: Associates a character with a specific media file.
 *     tags:
 *       - Media
 *       - Characters
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source.
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media file.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               characterId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Character added to media.
 *       400:
 *         description: Invalid data supplied.
 *       500:
 *         description: Internal server error.
 */
export async function POST({ params, request }: APIEvent) {
  try {
    const { mediaId } = MediaParamsSchema.parse(params);
    const body = await request.json();
    const { characterId } = CharacterBodySchema.parse(body);

    const result = await CharacterService.addCharacterToMedia(
      mediaId,
      characterId
    );
    return new Response(JSON.stringify(result), {
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

/**
 * @swagger
 * /api/sources/{mediaSourceId}/{mediaId}/characters:
 *   delete:
 *     summary: Remove a character from a media
 *     description: Removes the association between a character and a specific media file.
 *     tags:
 *       - Media
 *       - Characters
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source.
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media file.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               characterId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Character removed from media.
 *       400:
 *         description: Invalid data supplied.
 *       404:
 *         description: Association not found.
 *       500:
 *         description: Internal server error.
 */
export async function DELETE({ params, request }: APIEvent) {
  try {
    const { mediaId } = MediaParamsSchema.parse(params);
    const body = await request.json();
    const { characterId } = CharacterBodySchema.parse(body);

    const result = await CharacterService.removeCharacterFromMedia(
      mediaId,
      characterId
    );
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
    if (error instanceof NotFoundError) {
      return new Response(JSON.stringify({ error: "Association not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
