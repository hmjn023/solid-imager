import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { MediaService } from "~/application/services/media-service";
import { copyMediaRequestSchema } from "~/domain/media/schemas";
import { logger } from "~/infrastructure/logger";

const MediaParamsSchema = z.object({
  mediaSourceId: z.uuid({ version: "v4" }),
  mediaId: z.uuid({ version: "v4" }),
});

export async function POST({ params, request }: APIEvent) {
  const parsedParams = MediaParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { mediaSourceId: _mediaSourceId, mediaId } = parsedParams.data;

  const body = await request.json();
  const parsedBody = copyMediaRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return new Response(JSON.stringify({ errors: parsedBody.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { targetSourceId } = parsedBody.data;

  try {
    // Note: We might want to verify mediaSourceId matches the media's current source
    // but MediaService.copyMedia mainly uses mediaId.
    // Ideally validation should happen in the service or here.
    // Service validation handles finding the media by ID.
    const result = await MediaService.copyMedia(mediaId, targetSourceId);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    logger.error({ err: error }, "Request failed");
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
