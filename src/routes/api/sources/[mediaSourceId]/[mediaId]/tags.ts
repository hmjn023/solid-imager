import type { APIEvent } from "@solidjs/start/server";
import { ZodError, z } from "zod";
import { MediaService } from "~/application/services/media-service";
import { NotFoundError } from "~/infrastructure/db/errors";

// パスパラメータのスキーマ
const MediaParamsSchema = z.object({
  mediaSourceId: z.string().uuid(),
  mediaId: z.string().uuid(),
});

/**
 * @swagger
 * /api/sources/{mediaSourceId}/{mediaId}/tags:
 *   get:
 *     summary: Retrieve tags for a specific media
 *     description: Fetches a list of tags associated with a specific media file.
 *     tags:
 *       - Media
 *       - Tags
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
 *         description: A list of tags for the media.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Tag'
 *       400:
 *         description: Invalid source ID or media ID supplied.
 *       404:
 *         description: Media not found.
 *       500:
 *         description: Internal server error.
 */
export async function GET({ params }: APIEvent) {
  try {
    const parsedParams = MediaParamsSchema.parse(params);
    const { mediaSourceId, mediaId } = parsedParams;

    const tags = await MediaService.getMediaTags(mediaSourceId, mediaId);
    return new Response(JSON.stringify(tags), {
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
      return new Response(JSON.stringify({ error: "Media not found" }), {
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
