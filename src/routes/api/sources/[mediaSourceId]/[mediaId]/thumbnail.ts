import fs from "node:fs/promises";
import type { APIEvent } from "@solidjs/start/server";
import { getThumbnailPath } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";

export async function GET({ params }: APIEvent) {
  const mediaSourceId = params.mediaSourceId; // Not forcing UUID cast here to match path flexible usage if any? Actually UUID is expected.
  const mediaId = params.mediaId;

  try {
    const thumbnailPath = getThumbnailPath(mediaSourceId, mediaId);

    // Check if file exists
    try {
      await fs.access(thumbnailPath);
    } catch {
      return new Response("Thumbnail not found", { status: 404 });
    }

    const thumbnailBuffer = await fs.readFile(thumbnailPath);
    return new Response(thumbnailBuffer, {
      headers: { "Content-Type": "image/webp" },
    });
  } catch (error) {
    logger.error({ err: error, mediaId }, "Failed to serve thumbnail");
    return new Response("Thumbnail error", { status: 500 });
  }
}
