import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { MediaService } from "~/application/services/media-service";
import { moveMediaRequestSchema } from "~/domain/media/schemas";

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
  const parsedBody = moveMediaRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return new Response(JSON.stringify({ errors: parsedBody.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { targetSourceId } = parsedBody.data;

  try {
    const result = await MediaService.moveMedia(mediaId, targetSourceId);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
