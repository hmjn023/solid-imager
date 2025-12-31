import type { APIEvent } from "@solidjs/start/server";
import { MediaService } from "~/application/services/media-service";
import { MediaSourceService } from "~/application/services/media-source-service";
import type { MediaSource } from "~/domain/repositories/source-repository";
import {
  mediaSourceInfoSchema,
  type SafeMediaSource,
} from "~/domain/sources/schemas";
import { logger } from "~/infrastructure/logger";

const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;
const HTTP_STATUS_BAD_REQUEST = 400;

function toSafeMediaSource(source: MediaSource): SafeMediaSource {
  const { connectionInfo, ...rest } = source;
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic connection info handling
  const info = connectionInfo as any;

  if (source.type === "sftp") {
    // biome-ignore lint/correctness/noUnusedVariables: Omit from safe
    const { password, privateKey, ...safe } = info;
    return { ...rest, connectionInfo: safe };
  }
  if (source.type === "s3") {
    // biome-ignore lint/correctness/noUnusedVariables: Omit from safe
    const { accessKeyId, secretAccessKey, ...safe } = info;
    return { ...rest, connectionInfo: safe };
  }
  return { ...rest, connectionInfo: info };
}

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
    const result = await MediaSourceService.fetchSources();
    const safeResult = result.map(toSafeMediaSource);
    return new Response(JSON.stringify(safeResult), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to fetch media sources");
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
  try {
    const body = await request.json();
    const validatedData = mediaSourceInfoSchema.parse(body);

    const result = await MediaSourceService.createSource(validatedData);

    const createdSource = result[0];
    if (createdSource && createdSource.type === "local") {
      // Run in background
      MediaService.registerExistingMedia(
        createdSource.id,
        (createdSource.connectionInfo as { path: string }).path
      );

      // Start file system monitoring
      import("~/infrastructure/jobs/file-watcher-service")
        .then((module) => {
          module.FileWatcherService.startMonitoring(createdSource.id).catch(
            (error) => {
              logger.error(
                { err: error, sourceId: createdSource.id },
                "Failed to start file watcher"
              );
            }
          );
        })
        .catch((error) => {
          logger.error(
            { err: error, sourceId: createdSource.id },
            "Failed to load file watcher service"
          );
        });
    }

    return new Response(JSON.stringify(toSafeMediaSource(createdSource)), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "ZodError") {
      logger.warn({ err: error }, "Invalid source creation request");
      return new Response(
        JSON.stringify({ error: JSON.parse(error.message) }),
        {
          status: HTTP_STATUS_BAD_REQUEST,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }
    logger.error({ err: error }, "Failed to create media source");
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
