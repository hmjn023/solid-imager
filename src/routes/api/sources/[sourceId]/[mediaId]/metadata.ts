import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { getMediaMetadata } from "~/lib/api/media";
import type { UUID } from "~/lib/utils";

// Schema for path parameters
const MediaParamsSchema = z.object({
  sourceId: z.string().uuid(),
  mediaId: z.string().uuid(),
});

/**
 *
 * @param param0 {sourceId: UUID, mediaId: UUID}
 * @returns メディアのメタデータ
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
