/**
 * Download Jobs - Handles downloading images from URLs
 */

import fs from "node:fs/promises";
import path from "node:path";
import type {
  AddMediaRequest,
  DownloadItem,
  Media,
  NewAuthor,
} from "~/domain/media/schemas";

// import { selectMediaSourceById } from "~/infrastructure/db/queries/media-sources"; // Removed
// import { insertMediaUrls } from "~/infrastructure/db/queries/media-urls"; // Removed
import type { Job } from "~/infrastructure/jobs/job-manager";
import {
  addJobsToQueue,
  startJobQueue,
} from "~/infrastructure/jobs/job-manager";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository"; // Added
import { LocalMediaStorage } from "~/infrastructure/storage/local-media-storage";

const sourceRepo = new DrizzleSourceRepository();

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

/**
 * Formats download metadata as Markdown for the description field.
 */
function formatMetadataAsMarkdown(item: DownloadItem): string {
  return item.tweetText || "";
}

/**
 * Processes a download job by fetching the image from URL and registering it as media.
 */

// ... (existing imports)

// ...

export async function processDownloadJob(
  _job: Job,
  mediaSourceId: string,
  item: DownloadItem
): Promise<void> {
  const mediaSource = await sourceRepo.findById(mediaSourceId);
  if (!mediaSource || mediaSource.type !== "local") {
    throw new Error("Media source not found or not a local source");
  }

  const connectionInfo = mediaSource.connectionInfo as { path: string };
  const basePath = connectionInfo.path;

  // Generate filename from URL
  const urlPath = new URL(item.imageUrl).pathname;
  const originalFilename = path.basename(urlPath);
  const filename = `download-${Date.now()}-${originalFilename}`;
  const filePath = filename;
  const fullPath = path.join(basePath, filePath);
  // Download the image
  await downloadImage(item.imageUrl, fullPath);

  // Get file metadata
  const metadata = await LocalMediaStorage.getFileMetadata(fullPath);

  // Create media entry
  const newMedia: AddMediaRequest = {
    mediaSourceId,
    filePath,
    fileName: filename,
    mediaType: "image",
    description: formatMetadataAsMarkdown(item),
    width: metadata.width,
    height: metadata.height,
    fileSize: metadata.size,
    createdAt: item.timestamp ? new Date(item.timestamp) : metadata.createdAt,
    modifiedAt: metadata.modifiedAt,
  };

  let insertedMedia: Media;
  try {
    insertedMedia = await MediaRepository.create(newMedia);
  } catch (error) {
    // Handle race condition with FileWatcherService
    const existing = await MediaRepository.findByPath(mediaSourceId, filePath);
    if (existing) {
      insertedMedia = existing;
      // Update description if we have one and existing doesn't (or overwrite)
      if (newMedia.description) {
        await MediaRepository.update(existing.id, {
          description: newMedia.description,
        });
      }
    } else {
      throw error;
    }
  }

  // Register URLs
  const urlsToRegister = [item.imageUrl];
  if (item.tweetUrl) {
    urlsToRegister.push(item.tweetUrl);
  }
  await MediaRepository.addUrls(insertedMedia.id, urlsToRegister);

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
      sourcePath: basePath,
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
    } catch (_error) {
      // Continue with next item even if one fails
    }
  }

  return items.length;
}
