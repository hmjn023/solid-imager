import path from "node:path";

/**
 * Determines the media type based on the file extension.
 * @param fileName The name of the file
 * @returns 'video' | 'audio' | 'image'
 */
export function getMediaTypeFromExtension(
  fileName: string
): "video" | "audio" | "image" {
  const ext = path.extname(fileName).toLowerCase();
  if ([".mp4", ".webm", ".mov", ".mkv", ".avi"].includes(ext)) {
    return "video";
  }
  if ([".mp3", ".wav", ".ogg", ".m4a"].includes(ext)) {
    return "audio";
  }
  return "image";
}

/**
 * Determines the content type (MIME type) based on the file extension.
 * @param fileName The name of the file
 * @returns The MIME type string, defaulting to 'application/octet-stream'
 */
export function getContentTypeFromExtension(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase().replace(".", "");
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "mov":
      return "video/quicktime";
    case "mkv":
      return "video/x-matroska";
    case "avi":
      return "video/x-msvideo";
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "m4a":
      return "audio/mp4";
    default:
      return "application/octet-stream";
  }
}
