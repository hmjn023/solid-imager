/**
 * Download Jobs - Handles downloading images from URLs
 */

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type {
  AddMediaRequest,
  DownloadItem,
  Media,
  NewAuthor,
} from "~/domain/media/schemas";
import { getMediaTypeFromExtension } from "~/domain/media/utils/media-type-utils";
// import { selectMediaSourceById } from "~/infrastructure/db/queries/media-sources"; // Removed
// import { insertMediaUrls } from "~/infrastructure/db/queries/media-urls"; // Removed
import type { Job } from "~/infrastructure/jobs/job-manager";
import {
  addJobsToQueue,
  startJobQueue,
} from "~/infrastructure/jobs/job-manager";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { logger } from "~/infrastructure/logger";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository"; // Added
import { LocalMediaStorage } from "~/infrastructure/storage/local-media-storage";

const sourceRepo = new DrizzleSourceRepository();
const execFileAsync = promisify(execFile);
const DATE_REGEX = /(\d{4})(\d{2})(\d{2})/;

const TWITTER_URL_REGEX = /(twitter|x)\.com\/\w+\/status\/\d+/;
// biome-ignore lint/style/noMagicNumbers: Buffer size calculation
const MAX_BUFFER = 10 * 1024 * 1024; // 10MB

/**
 * Downloads an image from a URL and saves it to the specified path.
 * @param imageUrl - The URL of the image to download
 * @param outputPath - The path where the image should be saved
 */
async function downloadImage(
  imageUrl: string,
  outputPath: string
): Promise<void> {
  const response = await fetch(imageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to download image: ${response.status} ${response.statusText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);
}

type YtDlpOutput = {
  id: string;

  title: string;
  description: string;
  duration?: number;
  width?: number;
  height?: number;
  ext: string;
  uploader?: string;
  // biome-ignore lint/style/useNamingConvention: External API
  uploader_id?: string;
  // biome-ignore lint/style/useNamingConvention: External API
  upload_date?: string;
  _filename?: string;
  filename: string;
};

// biome-ignore lint/suspicious/noExplicitAny: External cookie object structure is loose
type Cookie = any;

async function createNetscapeCookieFile(
  cookies: Cookie[]
): Promise<string | null> {
  if (!Array.isArray(cookies) || cookies.length === 0) {
    return null;
  }

  // biome-ignore lint/style/noMagicNumbers: Radix for random string
  const randomSuffix = Math.random().toString(36).slice(2);
  const cookieFilePath = path.join(
    os.tmpdir(),
    `cookies-${Date.now()}-${randomSuffix}.txt`
  );

  try {
    const lines = ["# Netscape HTTP Cookie File"];

    for (const cookie of cookies) {
      const domain = cookie.domain;
      const flag = domain.startsWith(".") ? "TRUE" : "FALSE";
      const cookiePath = cookie.path;
      const secure = cookie.secure ? "TRUE" : "FALSE";
      const expiration = cookie.expirationDate
        ? Math.floor(cookie.expirationDate)
        : 0;
      const name = cookie.name;
      const value = cookie.value;

      lines.push(
        `${domain}\t${flag}\t${cookiePath}\t${secure}\t${expiration}\t${name}\t${value}`
      );
    }

    await fs.writeFile(cookieFilePath, lines.join("\n"));
    return cookieFilePath;
  } catch (e) {
    logger.warn({ err: e }, "Failed to create cookie file");
    return null;
  }
}

/**
 * Downloads video/media using yt-dlp
 */
async function downloadWithYtDlp(
  url: string,
  outputDir: string,
  options: {
    cookies?: Cookie[];
    userAgent?: string;
    outputTemplate?: string;
  } = {}
): Promise<{ filePath: string; metadata: YtDlpOutput }[]> {
  const { cookies, userAgent, outputTemplate } = options;
  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Verify yt-dlp is available
  try {
    await execFileAsync("yt-dlp", ["--version"]);
  } catch (_e) {
    throw new Error(
      "yt-dlp binary not found or not executable. Please ensure it is installed and in your PATH."
    );
  }

  const template = outputTemplate || "%(id)s.%(ext)s";
  const args = [
    "--no-simulate",
    "--print-json",
    "--paths",
    outputDir,
    "-o",
    template,
    // Twitter specific: ensure we get the best quality
    // "--format", "bestvideo+bestaudio/best", // default usually works well
    url,
  ];

  if (userAgent) {
    args.push("--user-agent", userAgent);
  }

  const cookieFilePath = await createNetscapeCookieFile(cookies || []);
  if (cookieFilePath) {
    args.push("--cookies", cookieFilePath);
  }

  try {
    const { stdout } = await execFileAsync("yt-dlp", args, {
      maxBuffer: MAX_BUFFER,
    });

    // yt-dlp may output multiple JSON objects (one per line) if it downloads multiple files (e.g. playlist, or multiple media in one tweet)
    // However, for single tweet URL, it might just be one.
    // We split by newline and parse each non-empty line.
    const results: { filePath: string; metadata: YtDlpOutput }[] = [];
    const lines = stdout.split("\n").filter((line) => line.trim().length > 0);

    for (const line of lines) {
      try {
        const data = JSON.parse(line) as YtDlpOutput;
        // filename in JSON might be absolute or relative depending on version,
        // but since we set paths, it usually returns the final path or we construct it.
        // Actually --print-json output 'filename' key is mostly the destination path.

        let finalPath = data.filename;
        if (!path.isAbsolute(finalPath)) {
          finalPath = path.join(outputDir, finalPath);
        }

        // We need the path relative to the source root for the DB
        // But here we return full path or just the filename?
        // Let's return the full path and handle relative path calculation in the caller.
        results.push({ filePath: finalPath, metadata: data });
      } catch (e) {
        logger.warn({ err: e }, "Failed to parse yt-dlp JSON line");
      }
    }

    return results;
  } catch (error) {
    logger.error({ err: error }, "yt-dlp execution failed");
    throw new Error(`yt-dlp failed: ${error}`);
  } finally {
    // Clean up cookie file
    if (cookieFilePath) {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: Safe ignore
      fs.unlink(cookieFilePath).catch(() => {});
    }
  }
}

/**
 * Formats download metadata as Markdown for the description field.
 */
function formatMetadataAsMarkdown(item: DownloadItem): string {
  return item.tweetText || "";
}

/**
 * helper to resolve creation date
 */
function resolveCreatedAt(
  item: DownloadItem,
  metadata: YtDlpOutput,
  fileMeta: { createdAt: Date }
): Date {
  if (item.timestamp) {
    return new Date(item.timestamp);
  }
  if (metadata.upload_date) {
    return new Date(metadata.upload_date.replace(DATE_REGEX, "$1-$2-$3"));
  }
  return fileMeta.createdAt;
}

// Update helper to determine media type from extension

async function handleYtDlpDownload(
  item: DownloadItem,
  mediaSourceId: string,
  basePath: string
) {
  // Use yt-dlp
  logger.info({ url: item.imageUrl }, "[DownloadJob] Using yt-dlp");

  let outputTemplate: string | undefined;
  if (item.targetFilePath) {
    // If target path is provided (e.g., "pending/id.ext"), preserve the "pending/id" part
    // but let yt-dlp decide the extension.
    const dir = path.dirname(item.targetFilePath);
    const name = path.parse(item.targetFilePath).name;
    outputTemplate = path.join(dir, `${name}.%(ext)s`);
  }

  try {
    const results = await downloadWithYtDlp(item.imageUrl, basePath, {
      cookies: item.cookies,
      userAgent: item.userAgent,
      outputTemplate,
    });

    logger.info(
      { count: results.length },
      "[DownloadJob] yt-dlp download completed"
    );

    for (const res of results) {
      const { filePath, metadata } = res;

      // Calculate relative path
      const relativePath = path.relative(basePath, filePath);

      // Determine media type
      const mediaType = getMediaTypeFromExtension(filePath);

      logger.info(
        { relativePath, mediaType },
        "[DownloadJob] Processing file from yt-dlp"
      );

      // Get file metadata (size etc, verify it exists)
      const fileMeta = await LocalMediaStorage.getFileMetadata(filePath);

      const newMedia: AddMediaRequest = {
        mediaSourceId,
        filePath: relativePath,
        fileName: path.basename(filePath),
        mediaType,
        description: item.tweetText || metadata.description || metadata.title,
        width: metadata.width || fileMeta.width || 0,
        height: metadata.height || fileMeta.height || 0,
        fileSize: fileMeta.size,
        createdAt: resolveCreatedAt(item, metadata, fileMeta),
        modifiedAt: fileMeta.modifiedAt,
        sourceUrls: [item.imageUrl], // The tweet URL
      };

      await registerMedia(newMedia, mediaSourceId, {
        item,
        basePath,
        originalTargetFilePath: item.targetFilePath,
      });
    }
  } catch (error) {
    logger.error({ err: error }, "[DownloadJob] yt-dlp download failed");

    // Notify frontend via SSE
    SseManager.sendEvent(mediaSourceId, "download-error", {
      url: item.imageUrl,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

export async function processDownloadJob(
  _job: Job,
  mediaSourceId: string,
  item: DownloadItem
): Promise<void> {
  logger.info({ url: item.imageUrl }, "[DownloadJob] Starting download job");

  const mediaSource = await sourceRepo.findById(mediaSourceId);
  if (!mediaSource || mediaSource.type !== "local") {
    const error = "Media source not found or not a local source";
    logger.error({ mediaSourceId }, `[DownloadJob] ${error}`);
    SseManager.sendEvent(mediaSourceId, "download-error", {
      url: item.imageUrl,
      error,
    });
    throw new Error(error);
  }

  const connectionInfo = mediaSource.connectionInfo as { path: string };
  const basePath = connectionInfo.path;

  // Decision: Direct download or yt-dlp?
  // If use yt-dlp for everything, it might be safer but slower.
  // Existing logic handles direct images.
  // We'll use yt-dlp if it's NOT a generic direct image URL, OR if it looks like a tweet URL.

  // Note: xtracter currently sends direct image links for images.
  // For videos, we plan to make it send the tweet URL.
  // So: if URL looks like a tweet (x.com/status/...), use yt-dlp.
  //     if URL ends in extension, use direct download.

  const isTwitterPost = item.imageUrl.match(TWITTER_URL_REGEX);

  logger.info(
    { isTwitterPost: !!isTwitterPost },
    "[DownloadJob] URL pattern check"
  );

  try {
    if (isTwitterPost) {
      logger.info({}, "[DownloadJob] Using yt-dlp download method");
      await handleYtDlpDownload(item, mediaSourceId, basePath);
    } else {
      logger.info({}, "[DownloadJob] Using direct image download method");

      // Traditional Direct Image Download
      // Generate filename from URL
      // Formulate filename
      let filePath: string;
      let filename: string;

      if (item.targetFilePath) {
        filePath = item.targetFilePath;
        filename = path.basename(filePath);
      } else {
        const urlPath = new URL(item.imageUrl).pathname;
        const originalFilename = path.basename(urlPath);
        filename = `download-${Date.now()}-${originalFilename}`;
        filePath = filename;
      }

      const fullPath = path.join(basePath, filePath);

      // Download the image
      await downloadImage(item.imageUrl, fullPath);

      // Get file metadata
      const metadata = await LocalMediaStorage.getFileMetadata(fullPath);

      // Determine media type using getMediaType
      const mediaType = getMediaTypeFromExtension(fullPath);

      // Create media entry
      const newMedia: AddMediaRequest = {
        mediaSourceId,
        filePath,
        fileName: filename,
        mediaType,
        description: formatMetadataAsMarkdown(item),
        width: metadata.width,
        height: metadata.height,
        fileSize: metadata.size,
        createdAt: item.timestamp
          ? new Date(item.timestamp)
          : metadata.createdAt,
        modifiedAt: metadata.modifiedAt,
        sourceUrls: [item.imageUrl, ...(item.tweetUrl ? [item.tweetUrl] : [])],
      };

      await registerMedia(newMedia, mediaSourceId, {
        item,
        basePath,
        originalTargetFilePath: item.targetFilePath,
      });
    }

    logger.info(
      { url: item.imageUrl },
      "[DownloadJob] Download completed successfully"
    );
  } catch (error) {
    logger.error(
      { err: error, url: item.imageUrl },
      "[DownloadJob] Download failed"
    );

    // Notify frontend via SSE
    SseManager.sendEvent(mediaSourceId, "download-error", {
      url: item.imageUrl,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

// biome-ignore lint/complexity: consolidated logic and internal helper
async function registerMedia(
  newMedia: AddMediaRequest,
  mediaSourceId: string,
  options: {
    item: DownloadItem;
    basePath: string;
    originalTargetFilePath?: string;
  }
) {
  const { item, basePath, originalTargetFilePath } = options;
  let insertedMedia: Media;
  try {
    insertedMedia = await MediaRepository.create(newMedia);
  } catch (error) {
    // 1. Try to find by the NEW file path (standard race condition check)
    let existing = await MediaRepository.findByPath(
      mediaSourceId,
      newMedia.filePath
    );

    // 2. If not found, and we have an original target path (pending record), check that.
    if (!existing && originalTargetFilePath) {
      existing = await MediaRepository.findByPath(
        mediaSourceId,
        originalTargetFilePath
      );

      // If found, it means we have a pending record (ghost) that needs to be updated
      // because the actual download resulted in a different path (e.g. diff extension)
      if (existing) {
        logger.info(
          {
            oldPath: originalTargetFilePath,
            newPath: newMedia.filePath,
            mediaId: existing.id,
          },
          "[DownloadJob] Updating pending media record with new file path"
        );
        await MediaRepository.update(existing.id, {
          filePath: newMedia.filePath,
          fileName: newMedia.fileName,
          mediaType: newMedia.mediaType,
          fileSize: newMedia.fileSize,
          width: newMedia.width,
          height: newMedia.height,
        });
      }
    }

    if (existing) {
      insertedMedia = existing;
      // Update description if we have one and existing doesn't (or overwrite)
      // Update description AND physical metadata because the existing record
      // might be a placeholder from importMetadata with 0 size/width/height.
      await MediaRepository.update(existing.id, {
        description: newMedia.description || existing.description,
        fileSize: newMedia.fileSize,
        width: newMedia.width,
        height: newMedia.height,
        mediaType: newMedia.mediaType,
        modifiedAt: newMedia.modifiedAt,
        createdAt: newMedia.createdAt,
      });
    } else {
      throw error;
    }
  }

  // Register URLs
  if (newMedia.sourceUrls && newMedia.sourceUrls.length > 0) {
    await MediaRepository.addUrls(insertedMedia.id, newMedia.sourceUrls);
  }

  // Register Author
  if (item.authorName) {
    const newAuthor: NewAuthor = {
      name: item.authorName,
      accountId: item.authorId,
    };
    const author = await AuthorRepository.create(newAuthor);
    await AuthorRepository.addMedia(insertedMedia.id, author.id);
  }

  // Queue thumbnail generation
  addJobsToQueue(mediaSourceId, [
    {
      mediaId: insertedMedia.id,
      sourcePath: basePath, // Use passed basePath
      type: "thumbnail",
    },
  ]);

  startJobQueue(mediaSourceId, async (thumbnailJob) => {
    const { processMediaJob } = await import(
      "~/infrastructure/jobs/thumbnails"
    );
    await processMediaJob(thumbnailJob, mediaSourceId);
  });

  // Notify success
  SseManager.sendEvent(mediaSourceId, "media-added", {
    mediaId: insertedMedia.id,
  });
}

/**
 * Queues multiple download jobs from a list of download items.
 */
export async function queueDownloadJobs(
  mediaSourceId: string,
  items: DownloadItem[]
): Promise<number> {
  const mediaSource = await sourceRepo.findById(mediaSourceId);
  if (!mediaSource || mediaSource.type !== "local") {
    throw new Error("Media source not found or not a local source");
  }

  const connectionInfo = mediaSource.connectionInfo as { path: string };
  const basePath = connectionInfo.path;

  // Process downloads sequentially to avoid overwhelming the system
  for (const item of items) {
    try {
      await processDownloadJob(
        {
          mediaId: "", // Will be set after download
          sourcePath: basePath,
          type: "downloadImage",
          payload: {
            imageUrl: item.imageUrl,
            sourceUrl: item.imageUrl,
            description: formatMetadataAsMarkdown(item),
            createdAt: item.timestamp ? new Date(item.timestamp) : new Date(),
          },
        },
        mediaSourceId,
        item
      );
    } catch (error) {
      logger.error(
        { err: error, url: item.imageUrl },
        "Failed to download item"
      );
      // Continue with next item even if one fails
    }
  }

  return items.length;
}
