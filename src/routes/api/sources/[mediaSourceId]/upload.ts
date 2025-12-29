import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { MediaService } from "~/application/services/media-service";
import { logger } from "~/infrastructure/logger";

const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;
const HTTP_STATUS_BAD_REQUEST = 400;

const SourceParamsSchema = z.object({
  mediaSourceId: z.uuid({ version: "v4" }),
});
export type SourceParams = z.infer<typeof SourceParamsSchema>;

/**
 * @swagger
 * /api/sources/{mediaSourceId}/upload:
 *   post:
 *     summary: Upload media to a specific media source
 *     description: Uploads a new media file to the specified media source.
 *     tags:
 *       - Media Sources
 *       - Media
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source to upload to.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/UploadRequest'
 *     responses:
 *       200:
 *         description: Media uploaded successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UploadResponse'
 *       400:
 *         description: Invalid input or file conflict.
 *       500:
 *         description: Internal server error.
 */
export async function POST({ params, request }: APIEvent) {
  const parsedParams = SourceParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
      status: HTTP_STATUS_BAD_REQUEST,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { mediaSourceId } = parsedParams.data;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file && file instanceof File)) {
      throw new Error("No file provided");
    }

    const result = await MediaService.uploadMedia(
      mediaSourceId,
      file,
      formData
    );
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ err: error }, "Request failed");
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
