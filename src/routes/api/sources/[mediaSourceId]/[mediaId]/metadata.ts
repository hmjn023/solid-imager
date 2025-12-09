import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { MediaService } from "~/application/services/media-service";

// パスパラメータのスキーマ
const MediaParamsSchema = z.object({
  mediaSourceId: z.uuid({ version: "v4" }),
  mediaId: z.uuid({ version: "v4" }),
});
export type MediaParams = z.infer<typeof MediaParamsSchema>;

/**
 * @swagger
 * /api/sources/{mediaSourceId}/{mediaId}/metadata:
 *   get:
 *     summary: Retrieve media metadata
 *     description: Fetches the generation metadata (e.g., prompt, workflow) for a specific media file.
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
 *         description: The metadata of the media.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaMetadata'
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

  const metadata = await MediaService.getMediaMetadata(
    mediaSourceId as string,
    mediaId as string
  );
  return new Response(JSON.stringify(metadata), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
