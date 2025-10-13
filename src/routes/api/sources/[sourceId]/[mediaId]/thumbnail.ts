import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import type { UUID } from "~/domain/shared/types";
import { getThumbnailPath } from "~/infrastructure/jobs/thumbnails";
import { getDriver } from "~/infrastructure/storage/factory";

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
    const thumbnailPath = getThumbnailPath(mediaId);

    const driver = getDriver(sourceId);

    const thumbnailBuffer = await driver.get(thumbnailPath);

    return new Response(thumbnailBuffer, {
      status: 200,

      headers: { "Content-Type": "image/webp" }, // Assuming webp as per jobs/thumbnails.ts
    });
  } catch (error) {
    console.error("Error retrieving thumbnail:", error);

    return new Response("Thumbnail not found", { status: 404 });
  }
}
