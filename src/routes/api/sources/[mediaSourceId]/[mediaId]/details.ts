import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import type { UUID } from "~/domain/shared/schemas";
import { getMediaDetails } from "~/infrastructure/api-clients/media";

// パスパラメータのスキーマ
const MediaParamsSchema = z.object({
  mediaSourceId: z.string().uuid(),
  mediaId: z.string().uuid(),
});
export type MediaParams = z.infer<typeof MediaParamsSchema>;

/**
 * @swagger
 * /api/sources/{mediaSourceId}/{mediaId}/details:
 *   get:
 *     summary: Retrieve media details
 *     description: Fetches detailed information for a specific media file, including tags, metadata, category, IP, and character information.
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
 *         description: Detailed information about the media.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaDetails'
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
    const details = await getMediaDetails(
      mediaSourceId as UUID,
      mediaId as UUID,
    );
    return new Response(JSON.stringify(details), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return new Response(JSON.stringify({ error: "Media not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
