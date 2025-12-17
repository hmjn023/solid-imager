import type { APIEvent } from "@solidjs/start/server";
import { queueAiTaggingForSource } from "~/infrastructure/jobs/ai-tagging";

/**
 * @swagger
 * /api/sources/{mediaSourceId}/ai-tagging:
 *   post:
 *     summary: Start AI tagging for all media in source
 *     description: Queues AI tagging jobs for all media items in the specified source.
 *     tags:
 *       - Sources
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the media source
 *     responses:
 *       202:
 *         description: Jobs accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 jobCount:
 *                   type: number
 *       500:
 *         description: Internal server error
 */
export async function POST({ params }: APIEvent) {
  try {
    const { mediaSourceId } = params;
    const count = await queueAiTaggingForSource(mediaSourceId);

    return new Response(
      JSON.stringify({ message: "AI Tagging jobs started", jobCount: count }),
      {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
