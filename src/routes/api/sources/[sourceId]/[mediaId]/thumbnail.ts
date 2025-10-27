import { promises as fs } from "node:fs";
import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { getThumbnailPath } from "~/infrastructure/jobs/thumbnails";

// パスパラメータのスキーマ
const MediaParamsSchema = z.object({
  sourceId: z.string().uuid(),
  mediaId: z.string().uuid(),
});

export async function GET({ params }: APIEvent) {
  const parsedParams = MediaParamsSchema.safeParse(params);

  if (!parsedParams.success) {
    return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
      status: 400,

      headers: { "Content-Type": "application/json" },
    });
  }

  const { sourceId, mediaId } = parsedParams.data;

  try {
    const thumbnailPath = getThumbnailPath(sourceId, mediaId);

    const thumbnailBuffer = await fs.readFile(thumbnailPath);

    return new Response(thumbnailBuffer, {
      status: 200,

      headers: { "Content-Type": "image/webp" }, // Assuming webp as per jobs/thumbnails.ts
    });
  } catch (_error) {
    return new Response("Thumbnail not found", { status: 404 });
  }
}
