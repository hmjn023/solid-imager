import type { APIEvent } from "@solidjs/start/server";
import { MediaService } from "~/application/services/media-service";
import type { UUID } from "~/domain/shared/schemas";
import { logger } from "~/infrastructure/logger";

export async function GET({ params }: APIEvent) {
  const mediaSourceId = params.mediaSourceId as UUID;
  const mediaId = params.mediaId as UUID;

  try {
    const buffer = await MediaService.getMediaContent(mediaSourceId, mediaId);

    // Determine content type (simple guess or logic)
    // For now assuming images/videos. Real implementation might need MIME type from DB or detection.
    // But usually browser can sniff or we can default to octet-stream.
    // Currently MediaService doesn't return mime type directly, but let's assume valid image response.

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      // headers: { "Content-Type": ... } // TODO: Get mime type
    });
  } catch (error) {
    logger.error({ err: error, mediaId }, "Failed to serve media content");
    return new Response("Media not found or error", { status: 404 });
  }
}
