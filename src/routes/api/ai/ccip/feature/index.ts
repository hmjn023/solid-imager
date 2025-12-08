import type { APIEvent } from "@solidjs/start/server";
import { taggingService } from "~/application/services/tagging-service";
import { ccipFeatureRequestSchema } from "~/domain/tagging/schemas";

/**
 * @swagger
 * /api/ai/ccip/feature:
 *   post:
 *     summary: Extract CCIP feature
 *     description: Extract CCIP feature vector from an image. Accepts either a file upload or a media ID.
 *     tags:
 *       - AI
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mediaSourceId:
 *                 type: string
 *               mediaId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Feature extracted successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Internal server error
 */
export async function POST({ request }: APIEvent) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!(file && file instanceof File)) {
        return new Response(JSON.stringify({ error: "File is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const buffer = await file.arrayBuffer();
      const feature = await taggingService.getCCIPFeature(buffer);

      return Response.json(feature);
    }
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const { mediaSourceId, mediaId } = ccipFeatureRequestSchema.parse(body);

      if (!(mediaSourceId && mediaId)) {
        return new Response(
          JSON.stringify({ error: "mediaSourceId and mediaId are required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const feature = await taggingService.getCCIPFeatureForMedia(
        mediaSourceId,
        mediaId
      );

      return Response.json(feature);
    }
    return new Response(JSON.stringify({ error: "Unsupported content type" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
