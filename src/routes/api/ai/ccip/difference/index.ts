import type { APIEvent } from "@solidjs/start/server";
import { taggingService } from "~/application/services/tagging-service";
import { ccipDifferenceRequestSchema } from "~/domain/tagging/schemas";

/**
 * @swagger
 * /api/ai/ccip/difference:
 *   post:
 *     summary: Calculate CCIP difference
 *     description: Calculate the difference between two CCIP feature vectors.
 *     tags:
 *       - AI
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - feature1
 *               - feature2
 *             properties:
 *               feature1:
 *                 type: array
 *                 items:
 *                   type: number
 *               feature2:
 *                 type: array
 *                 items:
 *                   type: number
 *     responses:
 *       200:
 *         description: Difference calculated successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Internal server error
 */
export async function POST({ request }: APIEvent) {
  try {
    const body = await request.json();
    const { feature1, feature2 } = ccipDifferenceRequestSchema.parse(body);

    const difference = await taggingService.getCCIPDifference(
      feature1,
      feature2
    );

    return Response.json({ difference });
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
