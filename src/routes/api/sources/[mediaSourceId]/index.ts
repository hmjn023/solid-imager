import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { MediaService } from "~/application/services/media-service";
import { MediaSourceService } from "~/application/services/media-source-service";
import { MediaSourceServiceV2 } from "~/application/services/media-source-service-v2";
import { mediaSourceInfoSchema } from "~/domain/sources/schemas";
import { logger } from "~/infrastructure/logger";

const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_BAD_REQUEST = 400;

const SourceParamsSchema = z.object({
  mediaSourceId: z.uuid({ version: "v4" }),
});
export type SourceParams = z.infer<typeof SourceParamsSchema>;

/**
 * @swagger
 * /api/sources/{mediaSourceId}:
 *   get:
 *     summary: Retrieve all media within a specific media source
 *     description: Fetches a list of all media files associated with a given media source ID.
 *     tags:
 *       - Media Sources
 *       - Media
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source.
 *     responses:
 *       200:
 *         description: A list of media files.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Media'
 *       400:
 *         description: Invalid source ID supplied.
 *       404:
 *         description: Media source not found.
 *       500:
 *         description: Internal server error.
 */
export async function GET({ params }: APIEvent) {
  const parsedParams = SourceParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
      status: HTTP_STATUS_BAD_REQUEST,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { mediaSourceId } = parsedParams.data;

  try {
    const result = await MediaService.getAllMedia(mediaSourceId);
    if (!result) {
      return new Response(JSON.stringify({ error: "Source not found" }), {
        status: HTTP_STATUS_NOT_FOUND,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: unknown) {
    logger.error(
      { err: error, mediaSourceId },
      "Failed to get media from source"
    );
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
 * /api/sources/{mediaSourceId}:
 *   put:
 *     summary: Update a specific media source
 *     description: Updates an existing media source with the provided data.
 *     tags:
 *       - Media Sources
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateMediaSource'
 *     responses:
 *       200:
 *         description: The updated media source.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaSource'
 *       400:
 *         description: Invalid source ID or invalid input.
 *       404:
 *         description: Media source not found.
 *       500:
 *         description: Internal server error.
 */
export async function PUT({ params, request }: APIEvent) {
  const parsedParams = SourceParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
      status: HTTP_STATUS_BAD_REQUEST,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { mediaSourceId } = parsedParams.data;

  try {
    const body = await request.json();
    // Use partial schema for updates
    const validatedData = mediaSourceInfoSchema.partial().parse(body);

    const useV2 = process.env.USE_REPO_V2 === "true";
    const service = useV2 ? MediaSourceServiceV2 : MediaSourceService;

    const result = await service.updateSource(mediaSourceId, validatedData);
    // updateSource returns an array, we want the first item
    const updatedSource = result[0];

    return new Response(JSON.stringify(updatedSource), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "ZodError") {
      logger.warn(
        { err: error, mediaSourceId },
        "Invalid source update request"
      );
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
    logger.error(
      { err: error, mediaSourceId },
      "Failed to update media source"
    );
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
 * /api/sources/{mediaSourceId}:
 *   delete:
 *     summary: Delete a specific media source
 *     description: Deletes a media source by its ID.
 *     tags:
 *       - Media Sources
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source to delete.
 *     responses:
 *       200:
 *         description: Media source successfully deleted.
 *       400:
 *         description: Invalid source ID supplied.
 *       404:
 *         description: Media source not found.
 *       500:
 *         description: Internal server error.
 */
export async function DELETE({ params }: APIEvent) {
  const parsedParams = SourceParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
      status: HTTP_STATUS_BAD_REQUEST,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { mediaSourceId } = parsedParams.data;

  try {
    const useV2 = process.env.USE_REPO_V2 === "true";
    const service = useV2 ? MediaSourceServiceV2 : MediaSourceService;

    const result = await service.deleteSource(mediaSourceId);
    // deleteSource returns an array, we want the first item
    const deletedSource = result[0];

    // Stop file system monitoring
    import("~/infrastructure/jobs/file-watcher-service")
      .then((module) => {
        module.FileWatcherService.stopMonitoring(mediaSourceId).catch(
          (error) => {
            logger.error(
              { err: error, mediaSourceId },
              "Failed to stop file watcher"
            );
          }
        );
      })
      .catch((error) => {
        logger.error(
          { err: error, mediaSourceId },
          "Failed to load file watcher service"
        );
      });

    return new Response(
      JSON.stringify({ success: true, result: deletedSource }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: unknown) {
    logger.error(
      { err: error, mediaSourceId },
      "Failed to delete media source"
    );
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
