import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { getAllMedia } from "~/infrastructure/api-clients/media";
import {
  deleteMediaSource,
  updateMediaSource,
} from "~/infrastructure/api-clients/sources";

const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_BAD_REQUEST = 400;

const SourceParamsSchema = z.object({
  mediaSourceId: z.string().uuid(),
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
    const result = await getAllMedia(mediaSourceId);
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
  const data = await request.json();

  try {
    const result = await updateMediaSource(mediaSourceId, data);
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
    const result = await deleteMediaSource(mediaSourceId);
    return new Response(JSON.stringify({ success: true, result }), {
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
