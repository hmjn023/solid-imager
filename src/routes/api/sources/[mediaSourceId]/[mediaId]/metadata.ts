import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import type { UUID } from "~/domain/shared/types";
import { getMediaMetadata } from "~/infrastructure/api-clients/media";

// パスパラメータのスキーマ
const MediaParamsSchema = z.object({
  sourceId: z.string().uuid(),
  mediaId: z.string().uuid(),
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
  const { sourceId, mediaId } = parsedParams.data;

  const metadata = await getMediaMetadata(sourceId as UUID, mediaId as UUID);
  return metadata;
}
