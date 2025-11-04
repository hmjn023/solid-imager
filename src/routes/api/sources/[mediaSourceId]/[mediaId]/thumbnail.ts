import { promises as fs } from "node:fs";
import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { getThumbnailPath } from "~/infrastructure/jobs/thumbnails";

// パスパラメータのスキーマ
const MediaParamsSchema = z.object({
  mediaSourceId: z.string().uuid(),
  mediaId: z.string().uuid(),
});
export type MediaParams = z.infer<typeof MediaParamsSchema>;

/**
 * @swagger
 * /api/sources/{mediaSourceId}/{mediaId}/thumbnail:
 *   get:
 *     summary: Retrieve a thumbnail for a specific media
 *     description: Delivers a generated thumbnail image for a given media file.
 *     tags:
 *       - Media
 *       - Thumbnails
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
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           description: Desired size of the thumbnail (e.g., 200, 400).
 *     responses:
 *       200:
 *         description: The thumbnail image.
 *         content:
 *           image/webp:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid source ID or media ID supplied.
 *       404:
 *         description: Thumbnail not found.
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
    const thumbnailPath = getThumbnailPath(mediaSourceId, mediaId);

    const thumbnailBuffer = await fs.readFile(thumbnailPath);

    return new Response(thumbnailBuffer, {
      status: 200,

      headers: { "Content-Type": "image/webp" }, // Assuming webp as per jobs/thumbnails.ts
    });
  } catch (_error) {
    return new Response("Thumbnail not found", { status: 404 });
  }
}
