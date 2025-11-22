import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { MediaService } from "~/application/services/media-service";
import { updateMediaRequestSchema } from "~/domain/media/schemas";

// パスパラメータのスキーマ
const MediaParamsSchema = z.object({
  mediaSourceId: z.string().uuid(),
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
  const { mediaSourceId, mediaId } = parsedParams.data;

  try {
    const media = await MediaService.getMedia(mediaSourceId, mediaId);
    const imageBuffer = await MediaService.getMediaContent(
      mediaSourceId,
      mediaId
    );

    return new Response(imageBuffer as unknown as BodyInit, {
      status: 200,
      headers: { "Content-Type": `image/${media.mediaType}` },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return new Response("Media not found", { status: 404 });
    }
    return new Response("Internal Server Error", { status: 500 });
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
  const { mediaSourceId, mediaId } = parsedParams.data;

  const body = await request.json();
  const parsedBody = updateMediaRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return new Response(JSON.stringify({ errors: parsedBody.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const data = parsedBody.data;

  const result = await MediaService.updateMedia(mediaSourceId, mediaId, data);
  return result;
}
