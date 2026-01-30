/**
 * Download Jobs - Handles downloading images from URLs
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import youtubedl from "youtube-dl-exec";
import { services } from "~/application/registry";
import type { AddMediaRequest, DownloadItem } from "~/domain/media/schemas";
import { getMediaTypeFromExtension } from "~/domain/media/utils/media-type-utils";
import type { Job } from "~/infrastructure/db/schema";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { logger } from "~/infrastructure/logger";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { LocalMediaStorage } from "~/infrastructure/storage/local-media-storage";

const DATE_REGEX = /(\d{4})(\d{2})(\d{2})/;
const TWITTER_URL_REGEX = /(twitter|x)\.com\/\w+\/status\/\d+/;
const URL_HASH_LENGTH = 12;

// ffmpeg-static may return null on unsupported platforms
const resolvedFfmpegPath = ffmpegPath ?? undefined;

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
 * Downloads video/media using yt-dlp via youtube-dl-exec
 */
async function downloadWithYtDlp(
  url: string,
  outputDir: string,
  cookies?: Cookie[],
  userAgent?: string
): Promise<{ filePath: string; metadata: YtDlpOutput }[]> {
  await fs.mkdir(outputDir, { recursive: true });

  const template = "%(id)s.%(ext)s";
  const cookieFilePath = await createNetscapeCookieFile(cookies || []);

  try {
    const result = await youtubedl(url, {
      noSimulate: true,
      printJson: true,
      paths: outputDir,
      output: template,
      format: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      mergeOutputFormat: "mp4",
      ...(resolvedFfmpegPath && { ffmpegLocation: resolvedFfmpegPath }),
      ...(userAgent && { userAgent }),
      ...(cookieFilePath && { cookies: cookieFilePath }),
      // biome-ignore lint/suspicious/noExplicitAny: library type definition missing flags
    } as any);

    // output handling
    const outputs = parseYtDlpOutput(result);

    return outputs.map((metadata) => {
      let finalPath = metadata.filename || metadata._filename || "";
      if (finalPath && !path.isAbsolute(finalPath)) {
        finalPath = path.join(outputDir, finalPath);
      }
      return { filePath: finalPath, metadata };
    });
  } catch (error) {
    // youtube-dl-exec errors include stderr
    if (error instanceof Error && "stderr" in error) {
      logger.error(
        { stderr: (error as Error & { stderr: string }).stderr },
        "yt-dlp execution failed"
      );
    } else {
      logger.error({ err: error }, "yt-dlp execution failed");
    }
    throw new Error(`yt-dlp failed: ${error}`);
  } finally {
    if (cookieFilePath) {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: Cleanup
      fs.unlink(cookieFilePath).catch(() => { });
    }
  }
}

function parseYtDlpOutput(result: unknown): YtDlpOutput[] {
  let outputs: YtDlpOutput[] = [];

  if (typeof result === "string") {
    const lines = (result as string)
      .split("\n")
      .filter((line) => line.trim().length > 0);
    outputs = lines.map((line) => JSON.parse(line));
  } else if (Array.isArray(result)) {
    outputs = result as unknown as YtDlpOutput[];
  } else if (typeof result === "object" && result !== null) {
    outputs = [result as unknown as YtDlpOutput];
  } else {
    logger.warn(
      { resultType: typeof result, result },
      "Unexpected yt-dlp output type"
    );
    throw new Error(`Unexpected yt-dlp output type: ${typeof result}`);
  }
  return outputs;
}

/**
 * Fetches metadata using yt-dlp without downloading the file.
 */
async function fetchMetadataWithYtDlp(
  url: string,
  cookies?: Cookie[],
  userAgent?: string
): Promise<YtDlpOutput | null> {
  const cookieFilePath = await createNetscapeCookieFile(cookies || []);

  try {
    const result = await youtubedl(url, {
      dumpSingleJson: true,
      noDownload: true,
      ...(resolvedFfmpegPath && { ffmpegLocation: resolvedFfmpegPath }),
      ...(userAgent && { userAgent }),
      ...(cookieFilePath && { cookies: cookieFilePath }),
      // biome-ignore lint/suspicious/noExplicitAny: library type definition missing flags
    } as any);

    return result as unknown as YtDlpOutput;
  } catch (error) {
    logger.warn({ err: error, url }, "Failed to fetch metadata with yt-dlp");
    return null;
  } finally {
    if (cookieFilePath) {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: Cleanup
      fs.unlink(cookieFilePath).catch(() => { });
    }
  }
}

/**
 * Formats download metadata as Markdown for the description field.
 */
function formatMetadataAsMarkdown(item: DownloadItem): string {
  return item.description || "";
}

/**
 * helper to resolve creation date
 */
function resolveCreatedAt(
  item: DownloadItem,
  metadata: YtDlpOutput,
  fileMeta: { createdAt: Date }
): Date {
  if (item.createdAt) {
    return new Date(item.createdAt);
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
  if (!item.targetUrl) {
    throw new Error("Missing targetUrl for yt-dlp download");
  }

  // Use yt-dlp
  logger.info({ url: item.targetUrl }, "[DownloadJob] Using yt-dlp");

  try {
    const results = await downloadWithYtDlp(
      item.targetUrl,
      basePath,
      item.cookies,
      item.userAgent
    );

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
        description: item.description || metadata.description || metadata.title,
        width: metadata.width || fileMeta.width || 0,
        height: metadata.height || fileMeta.height || 0,
        fileSize: fileMeta.size,
        createdAt: resolveCreatedAt(item, metadata, fileMeta),
        modifiedAt: fileMeta.modifiedAt,
        sourceUrls: Array.from(
          new Set([item.targetUrl, ...(item.sourceUrls ?? [])])
        ),
      };

      await registerMedia(newMedia, mediaSourceId, item, basePath);
    }
  } catch (error) {
    logger.error({ err: error }, "[DownloadJob] yt-dlp download failed");

    // Notify frontend via SSE
    SseManager.sendEvent(mediaSourceId, "download-error", {
      url: item.targetUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handles direct image download (non-twitter)
 */
async function handleDirectImageDownload(
  item: DownloadItem,
  mediaSourceId: string,
  basePath: string
) {
  if (!item.targetUrl) {
    throw new Error("Missing targetUrl for direct download");
  }

  logger.info({}, "[DownloadJob] Using direct image download method");

  // Generate filename from URL
  const urlPath = new URL(item.targetUrl).pathname;
  const originalFilename = path.basename(urlPath);

  const { createHash } = await import("node:crypto");
  const urlHash = createHash("md5")
    .update(item.targetUrl)
    .digest("hex")
    .slice(0, URL_HASH_LENGTH);
  const filename = `download-${urlHash}-${originalFilename}`;
  const filePath = filename;
  const fullPath = path.join(basePath, filePath);

  try {
    // Download the image
    await downloadImage(item.targetUrl, fullPath);

    // Get file metadata
    const fileMetadata = await LocalMediaStorage.getFileMetadata(fullPath);

    let createdAt = item.createdAt ? new Date(item.createdAt) : undefined;

    // If createdAt is missing, try to fetch from source URL (e.g. Tweet URL)
    if (!createdAt) {
      const tweetUrl = item.sourceUrls?.find((u) => u.match(TWITTER_URL_REGEX));
      if (tweetUrl) {
        logger.info(
          { tweetUrl },
          "[DownloadJob] Attempting to fetch metadata from source URL for timestamp"
        );
        const meta = await fetchMetadataWithYtDlp(
          tweetUrl,
          item.cookies,
          item.userAgent
        );
        if (meta?.upload_date) {
          createdAt = new Date(
            meta.upload_date.replace(DATE_REGEX, "$1-$2-$3")
          );
          logger.info(
            { createdAt },
            "[DownloadJob] Resolved createdAt from source URL"
          );
        }
      }
    }

    // Fallback to file creation time
    if (!createdAt) {
      createdAt = fileMetadata.createdAt;
    }

    // Determine media type using getMediaType
    const mediaType = getMediaTypeFromExtension(fullPath);

    // Create media entry
    const newMedia: AddMediaRequest = {
      mediaSourceId,
      filePath,
      fileName: filename,
      mediaType,
      description: formatMetadataAsMarkdown(item),
      width: fileMetadata.width,
      height: fileMetadata.height,
      fileSize: fileMetadata.size,
      createdAt,
      modifiedAt: fileMetadata.modifiedAt,
      sourceUrls: Array.from(
        new Set([item.targetUrl, ...(item.sourceUrls ?? [])])
      ),
    };

    await registerMedia(newMedia, mediaSourceId, item, basePath);

    logger.info(
      { url: item.targetUrl },
      "[DownloadJob] Download completed successfully"
    );
  } catch (error) {
    logger.error(
      { err: error, url: item.targetUrl },
      "[DownloadJob] Download failed"
    );

    // Notify frontend via SSE
    SseManager.sendEvent(mediaSourceId, "download-error", {
      url: item.targetUrl,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * Extracts and normalizes a DownloadItem from a job payload.
 * Handles backward compatibility mapping.
 */
function getDownloadItemFromJob(job: Job): DownloadItem {
  if (!job.payload) {
    return {} as DownloadItem;
  }
  // biome-ignore lint/suspicious/noExplicitAny: Payload cast
  const payload = job.payload as any;
  const item = { ...payload } as unknown as DownloadItem;

  if (!item.targetUrl && payload?.imageUrl) {
    item.targetUrl = payload.imageUrl;
  }

  if (!item.description && payload?.description) {
    item.description = payload.description;
  }

  if (!item.sourceUrls) {
    item.sourceUrls = payload?.sourceUrl ? [payload.sourceUrl] : [];
  }

  return item;
}

export async function processDownloadJob(job: Job): Promise<void> {
  const mediaSourceId = job.mediaSourceId;
  if (!mediaSourceId) {
    logger.error({ jobId: job.id }, "Missing mediaSourceId in download job");
    return;
  }
  // Extract item directly from job payload (new schema) or fallbacks (backward compatibility)
  const item = getDownloadItemFromJob(job);

  if (!item.targetUrl) {
    logger.error({ job }, "[DownloadJob] Job payload missing targetUrl");
    return;
  }

  logger.info({ url: item.targetUrl }, "[DownloadJob] Starting download job");

  const sourceRepo = new DrizzleSourceRepository();
  const mediaSource = await sourceRepo.findById(mediaSourceId);
  if (!mediaSource || mediaSource.type !== "local") {
    const error = "Media source not found or not a local source";
    logger.error({ mediaSourceId }, `[DownloadJob] ${error}`);
    SseManager.sendEvent(mediaSourceId, "download-error", {
      url: item.targetUrl,
      error,
    });
    throw new Error(error);
  }

  const connectionInfo = mediaSource.connectionInfo as { path: string };
  const basePath = connectionInfo.path;

  // Decision: Direct download or yt-dlp?
  // Use regex to detect Twitter URLs which might need yt-dlp if target is the tweet link
  const isTwitterPost = item.targetUrl.match(TWITTER_URL_REGEX);

  logger.info(
    { isTwitterPost: !!isTwitterPost },
    "[DownloadJob] URL pattern check"
  );

  try {
    if (isTwitterPost) {
      logger.info({}, "[DownloadJob] Using yt-dlp download method");
      await handleYtDlpDownload(item, mediaSourceId, basePath);
    } else {
      await handleDirectImageDownload(item, mediaSourceId, basePath);
    }
  } catch (error) {
    logger.error(
      { err: error, url: item.targetUrl },
      "[DownloadJob] Job execution failed"
    );
    // Notify frontend via SSE
    SseManager.sendEvent(mediaSourceId, "download-error", {
      url: item.targetUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Helper to update existing media with download metadata when media already exists
 * (handles race condition with FileWatcherService)
 */
async function updateExistingMediaWithMetadata(
  mediaId: string,
  mediaSourceId: string,
  newMedia: AddMediaRequest,
  item: DownloadItem
): Promise<void> {
  const { MediaProcessingService } = await import(
    "~/application/services/media-processing-service"
  );

  await MediaProcessingService.addContextMetadataToExistingMedia(mediaId, {
    description: newMedia.description ?? undefined,
    sourceUrls: newMedia.sourceUrls,
    authors: item.authors?.map((a) => ({
      name: a.name,
      accountId: a.accountId ?? null,
    })),
    // We can also update other metadata if needed, consistent with registerMedia
    tags: item.tags,
    characters: item.characters,
    ips: item.ips,
    projects: item.projects,
  });

  SseManager.sendEvent(mediaSourceId, "media-added", { mediaId });
  logger.info(
    { mediaId },
    "[DownloadJob] Existing media updated with download metadata"
  );
}

async function registerMedia(
  newMedia: AddMediaRequest,
  mediaSourceId: string,
  item: DownloadItem,
  _basePath: string
) {
  try {
    // Use MediaProcessingService for unified registration and processing
    const { MediaProcessingService } = await import(
      "~/application/services/media-processing-service"
    );

    const insertedMedia = await MediaProcessingService.registerAndProcess(
      mediaSourceId,
      newMedia.filePath,
      {
        description: newMedia.description ?? undefined,
        createdAt: newMedia.createdAt,
        sourceUrls: newMedia.sourceUrls,
        authors: item.authors?.map((a) => ({
          name: a.name,
          accountId: a.accountId ?? null,
        })),
        tags: item.tags,
        characters: item.characters,
        ips: item.ips,
        projects: item.projects,
        generationInfo: item.generationInfo,
      }
    );

    logger.info(
      { mediaId: insertedMedia.id, filePath: newMedia.filePath },
      "[DownloadJob] Media registered via MediaProcessingService"
    );
  } catch (error) {
    // Handle race condition with FileWatcherService
    const existing = await MediaRepository.findByPath(
      mediaSourceId,
      newMedia.filePath
    );
    if (existing) {
      await updateExistingMediaWithMetadata(
        existing.id,
        mediaSourceId,
        newMedia,
        item
      );
    } else {
      throw error;
    }
  }
}

/**
 * Queues multiple download jobs from a list of download items.
 */
export async function queueDownloadJobs(
  mediaSourceId: string,
  items: DownloadItem[]
): Promise<number> {
  const sourceRepo = new DrizzleSourceRepository();
  const mediaSource = await sourceRepo.findById(mediaSourceId);
  if (!mediaSource || mediaSource.type !== "local") {
    throw new Error("Media source not found or not a local source");
  }

  const repo = services.getJobRepository();

  for (const item of items) {
    await repo.create({
      type: "downloadImage",
      mediaSourceId,
      payload: {
        ...item,
        // Backward compatibility fields
        imageUrl: item.targetUrl,
        sourceUrl: item.targetUrl,
        description: item.description ?? formatMetadataAsMarkdown(item),
        createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
      },
    });
  }

  // Jobs are picked up by the worker automatically.

  return items.length;
}
