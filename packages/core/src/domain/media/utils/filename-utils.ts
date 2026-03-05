import type { DownloadItem } from "../schemas";

/**
 * Sanitize a string to be used as a filename part.
 */
export function sanitizeFilenamePart(part: string): string {
  // Remove or replace characters that are invalid in filenames across OSes
  // Also remove @ at the beginning of Twitter IDs for cleaner filenames
  const cleaned = part.startsWith("@") ? part.slice(1) : part;
  return cleaned.replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, "_");
}

/**
 * Extract a unique ID from common media source URLs (Twitter, Danbooru).
 */
export function extractIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // Twitter/X: https://twitter.com/user/status/123456789
    if (
      urlObj.hostname.includes("twitter.com") ||
      urlObj.hostname.includes("x.com")
    ) {
      const match = urlObj.pathname.match(/\/status\/(\d+)/);
      return match ? match[1] : null;
    }
    // Danbooru: https://danbooru.donmai.us/posts/123456
    if (urlObj.hostname.includes("danbooru.donmai.us")) {
      const match = urlObj.pathname.match(/\/posts\/(\d+)/);
      return match ? match[1] : null;
    }
  } catch (_e) {
    return null;
  }
  return null;
}

/**
 * Generate a unified filename based on media metadata.
 * Format: {authorId}_{date}_{contentId}.{extension}
 */
export function generateMediaFilename(
  item: DownloadItem,
  extension: string
): string {
  // 1. Author ID
  const author = item.authors?.[0];
  let authorId = "";
  if (author?.accountId) {
    authorId = sanitizeFilenamePart(author.accountId);
  } else if (author?.name) {
    authorId = sanitizeFilenamePart(author.name);
  }

  // 2. Date (YYYYMMDD)
  let dateStr = "";
  if (item.createdAt) {
    const date = new Date(item.createdAt);
    if (!isNaN(date.getTime())) {
      dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    }
  }

  // 3. Content ID (Twitter status ID, Danbooru post ID, etc.)
  let contentId = "";
  if (item.sourceUrls) {
    for (const url of item.sourceUrls) {
      const id = extractIdFromUrl(url);
      if (id) {
        contentId = id;
        break;
      }
    }
  }

  if (!contentId && item.targetUrl) {
    contentId = extractIdFromUrl(item.targetUrl) || "";
  }

  // Fallback: If we still don't have enough info, use URL hash or timestamp
  if (!authorId && !dateStr && !contentId) {
    if (item.targetUrl) {
      try {
        const url = new URL(item.targetUrl);
        const filename = url.pathname.split("/").pop();
        if (filename && filename.includes(".")) {
          return filename; // Use original filename from URL
        }
        // Hash-like from URL
        contentId = url.pathname.replace(/[^a-zA-Z0-9]/g, "_").slice(-12);
      } catch (_e) {
        contentId = Date.now().toString();
      }
    } else {
      contentId = Date.now().toString();
    }
  }

  // Build filename
  const parts = [];
  if (authorId) parts.push(authorId);
  if (dateStr) parts.push(dateStr);
  if (contentId) parts.push(contentId);

  let base = parts.join("_");
  if (!base) base = "media";

  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  // Ensure no double dots and the extension is at the end
  const cleanExt = ext.split("?")[0].split("#")[0]; // remove query/hash if any

  return `${base}${cleanExt}`;
}
