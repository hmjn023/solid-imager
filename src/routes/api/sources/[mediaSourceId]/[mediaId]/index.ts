import { promises as fs } from "node:fs";
import path from "node:path";
import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { updateMediaRequestSchema } from "~/domain/media/schemas";
import type { UUID } from "~/domain/shared/types";
import { getMedia, updateMedia } from "~/infrastructure/api-clients/media";
import { selectMediaSourceById } from "~/infrastructure/db/queries/media-sources";

// パスパラメータのスキーマ
const MediaParamsSchema = z.object({
  sourceId: z.string().uuid(),
  mediaId: z.string().uuid(),
});
export type MediaParams = z.infer<typeof MediaParamsSchema>;

/**
 * @swagger
 * /api/sources/{mediaSourceId}/{mediaId}:
 *   get:
 *     summary: Retrieve a specific media file
 *     description: Fetches a specific media file by its source ID and media ID.
 *     tags:
 *       - Media
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
 *         description: The requested media file.
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid source ID or media ID supplied.
 *       404:
 *         description: Media not found.
 *       500:
 *         description: Internal server error.
 */
export async function GET({ params }: APIEvent) {
  const parsedParams = MediaParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { sourceId, mediaId } = parsedParams.data;

  try {
    const media = await getMedia(sourceId as UUID, mediaId as UUID);
    const source = await selectMediaSourceById(sourceId as UUID);

    if (!source || source.type !== "local") {
      return new Response("Media source not found or not local", {
        status: 404,
      });
    }

    const imagePath = path.join(source.connectionInfo.path, media.filePath);
    const imageBuffer = await fs.readFile(imagePath);

    return new Response(imageBuffer, {
      status: 200,
      headers: { "Content-Type": `image/${media.mediaType}` },
    });
  } catch (_error) {
    return new Response("Original image not found", { status: 404 });
  }
}

/**
 * @swagger
 * /api/sources/{mediaSourceId}/{mediaId}:
 *   put:
 *     summary: Update specific media information
 *     description: Updates metadata and other information for a specific media file.
 *     tags:
 *       - Media
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
 *         description: UUID of the media file to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateMediaRequest'
 *     responses:
 *       200:
 *         description: Media information updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UpdateMediaResponse'
 *       400:
 *         description: Invalid input or media ID.
 *       404:
 *         description: Media not found.
 *       500:
 *         description: Internal server error.
 */
export async function PUT({ params, request }: APIEvent) {
  const parsedParams = MediaParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { sourceId, mediaId } = parsedParams.data;

  const body = await request.json();
  const parsedBody = updateMediaRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return new Response(JSON.stringify({ errors: parsedBody.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const data = parsedBody.data;

  const result = await updateMedia(sourceId, mediaId, data);
  return result;
}
