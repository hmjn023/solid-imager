import type { APIEvent } from "@solidjs/start/server";
import { registerExistingMedia } from "~/infrastructure/api-clients/media";
import {
  createMediaSource,
  getMediaSources,
} from "~/infrastructure/api-clients/sources";

const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

/**
 * @swagger
 * /api/sources:
 *   get:
 *     summary: Retrieve all media sources
 *     description: Fetches a list of all configured media sources.
 *     tags:
 *       - Media Sources
 *     responses:
 *       200:
 *         description: A list of media sources.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MediaSource'
 *       500:
 *         description: Internal server error.
 */
/**
 * Handles GET requests to retrieve all media sources.
 * It fetches the media sources from the database and returns them as a JSON response.
 * @returns {Promise<Response>} A Response object containing the list of media sources or an error message.
 */
export async function GET() {
  try {
    const result = await getMediaSources();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

/**
 * @swagger
 * /api/sources:
 *   post:
 *     summary: Create a new media source
 *     description: Adds a new media source to the system and starts scanning it if it's a local source.
 *     tags:
 *       - Media Sources
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewMediaSource'
 *     responses:
 *       201:
 *         description: The created media source.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaSource'
 *       500:
 *         description: Internal server error.
 */
/**
 * Handles POST requests to create a new media source.
 * It creates a new media source in the database and, if it's a local source,
 * triggers a background job to register existing media.
 * @param {APIEvent} event - The API event object, containing the request.
 * @returns {Promise<Response>} A Response object containing the newly created media source or an error message.
 */
export async function POST({ request }: APIEvent) {
  const { name, description, type, connectionInfo } = await request.json();

  try {
    const result = await createMediaSource({
      name,
      description,
      type,
      connectionInfo,
    });

    if (result && result.type === "local") {
      // Run in background
      registerExistingMedia(result.id, result.connectionInfo.path);
    }

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
