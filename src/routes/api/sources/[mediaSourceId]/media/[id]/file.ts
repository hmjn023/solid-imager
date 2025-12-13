import { APIEvent } from "@solidjs/start/server";
import { MediaService } from "~/application/services/media-service";

export async function GET({ params }: APIEvent) {
  const { mediaSourceId, id } = params;

  try {
    // MediaService.getMediaContent handles source lookup and driver usage
    const buffer = await MediaService.getMediaContent(mediaSourceId, id);

    // TODO: Determine mime type properly. For now assuming typical image types based on DB or file content.
    // Ideally getMediaContent or getMedia should return mime type.
    // We can infer from file extension or magic bytes if needed.
    // For now, let's just return as application/octet-stream or let browser sniff if we don't know.
    // But since it's mostly images, let's look up media info first.

    const media = await MediaService.getMedia(mediaSourceId, id);
    const ext = media.fileName.split(".").pop()?.toLowerCase();
    let mimeType = "application/octet-stream";

    if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
    else if (ext === "png") mimeType = "image/png";
    else if (ext === "gif") mimeType = "image/gif";
    else if (ext === "webp") mimeType = "image/webp";
    else if (ext === "mp4") mimeType = "video/mp4";

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("Failed to proxy media:", error);
    return new Response("Media not found", { status: 404 });
  }
}
