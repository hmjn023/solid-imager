import type { DownloadItem } from "../schemas";

const TWITTER_ID_PREFIX_LENGTH = 1;
const FILENAME_SANITIZE_REGEX = /[/\\?%*:|"<>.]/g;
const WHITESPACE_REGEX = /\s+/g;

/**
 * Sanitize a string to be used as a filename part.
 */
export function sanitizeFilenamePart(part: string): string {
  // Remove or replace characters that are invalid in filenames across OSes
  // Also remove @ at the beginning of Twitter IDs for cleaner filenames
  const trimmed = part.trim();
  const cleaned = trimmed.startsWith("@")
    ? trimmed.slice(TWITTER_ID_PREFIX_LENGTH)
    : trimmed;
  // Remove dots and other path characters to prevent path traversal
  return cleaned
    .replace(FILENAME_SANITIZE_REGEX, "")
    .replace(WHITESPACE_REGEX, "_");
}

const TWITTER_STATUS_REGEX = /\/status\/(\d+)/;
const DANBOORU_POST_REGEX = /\/posts\/(\d+)/;

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
      const match = urlObj.pathname.match(TWITTER_STATUS_REGEX);
      return match ? match[1] : null;
    }
    // Danbooru: https://danbooru.donmai.us/posts/123456
    if (urlObj.hostname.includes("danbooru.donmai.us")) {
      const match = urlObj.pathname.match(DANBOORU_POST_REGEX);
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
  const authorId = getAuthorPart(item);
  const dateStr = getDatePart(item);
  const contentId = getContentIdPart(item);

  let base = "";
  if (authorId || dateStr || contentId) {
    const parts: string[] = [];
    if (authorId) {
      parts.push(authorId);
    }
    if (dateStr) {
      parts.push(dateStr);
    }
    if (contentId) {
      parts.push(contentId);
    }
    base = parts.join("_");
  } else {
    base = getFallbackBase(item);
  }

  if (!base) {
    base = "media";
  }

  return `${base}${sanitizeExtension(extension)}`;
}

function getAuthorPart(item: DownloadItem): string {
  const author = item.authors?.[0];
  if (author?.accountId) {
    return sanitizeFilenamePart(author.accountId);
  }
  if (author?.name) {
    return sanitizeFilenamePart(author.name);
  }
  return "";
}

function getDatePart(item: DownloadItem): string {
  if (item.createdAt) {
    const date = new Date(item.createdAt);
    if (!Number.isNaN(date.getTime())) {
      const DATE_ISO_SUBSTRING_START = 0;
      const DATE_ISO_SUBSTRING_END = 10;
      return date
        .toISOString()
        .slice(DATE_ISO_SUBSTRING_START, DATE_ISO_SUBSTRING_END)
        .replace(/-/g, "");
    }
  }
  return "";
}

function getContentIdPart(item: DownloadItem): string {
  if (item.sourceUrls) {
    for (const url of item.sourceUrls) {
      const id = extractIdFromUrl(url);
      if (id) {
        return id;
      }
    }
  }

  if (item.targetUrl) {
    return extractIdFromUrl(item.targetUrl) || "";
  }

  return "";
}

function getFallbackBase(item: DownloadItem): string {
  if (item.targetUrl) {
    try {
      const url = new URL(item.targetUrl);
      const originalFilename = url.pathname.split("/").pop();
      if (originalFilename?.includes(".")) {
        const baseName = originalFilename.split(".").slice(0, -1).join(".");
        return sanitizeFilenamePart(baseName);
      }
      // Hash-like from URL
      const HASH_LIKE_TRAILING_LENGTH = 12;
      const NON_ALPHANUM_REGEX = /[^a-zA-Z0-9]/g;
      return url.pathname
        .replace(NON_ALPHANUM_REGEX, "_")
        .slice(-HASH_LIKE_TRAILING_LENGTH);
    } catch (_e) {
      return Date.now().toString();
    }
  }
  return Date.now().toString();
}

function sanitizeExtension(extension: string): string {
  let cleanExt = extension.split("?")[0].split("#")[0];
  if (cleanExt) {
    cleanExt = sanitizeFilenamePart(cleanExt);
    if (cleanExt) {
      return `.${cleanExt}`;
    }
  }
  return "";
}
