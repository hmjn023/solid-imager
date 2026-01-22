/**
 * Media Registration - Common logic for registering and updating media with job queuing
 *
 * This module centralizes the media registration workflow to prevent inconsistencies
 * and missing job registrations across different entry points (file watcher, downloads, manual uploads).
 */

import type { AddMediaRequest, NewAuthor } from "~/domain/media/schemas";
import type { Media } from "~/infrastructure/db/schema";
import {
  addJobsToQueue,
  type Job,
  startJobQueue,
} from "~/infrastructure/jobs/job-manager";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { processMediaJob } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";

/**
 * Author data for media registration
 */
export type AuthorData = {
  name: string;
  accountId?: string | null;
};

/**
 * Parameters for registering new media with jobs
 */
export type RegisterMediaWithJobsParams = {
  /** Media source ID */
  mediaSourceId: string;
  /** New media data to register */
  newMedia: AddMediaRequest;
  /** Base path of the media source */
  basePath: string;
  /** Optional author data */
  authors?: AuthorData[];
  /**
   * Whether to skip immediate metadata extraction.
   * Set to true when metadata extraction should be handled by the thumbnail job.
   * Default: true (metadata extraction happens in thumbnail job)
   */
  skipMetadataExtraction?: boolean;
};

/**
 * Parameters for updating media with jobs
 */
export type UpdateMediaWithJobsParams = {
  /** Media source ID */
  mediaSourceId: string;
  /** Media ID to update */
  mediaId: string;
  /** Base path of the media source */
  basePath: string;
  /** Media updates */
  updates: {
    width?: number;
    height?: number;
    fileSize?: number;
    modifiedAt?: Date;
    [key: string]: unknown;
  };
};

/**
 * Registers new media in the database and queues thumbnail and tag extraction jobs.
 *
 * This function centralizes the media registration workflow to ensure consistency
 * across different entry points (file watcher, downloads, manual uploads).
 *
 * Flow:
 * 1. Create media record in database
 * 2. Register source URLs (if provided)
 * 3. Register authors (if provided)
 * 4. Queue thumbnail and extractTags jobs
 * 5. Start job queue processing
 * 6. Send SSE notification
 *
 * Note: Metadata extraction is handled by the thumbnail job (processMediaJob),
 * not in this function, to avoid duplication.
 *
 * @param params - Registration parameters
 * @returns The registered media record
 */
/**
 * Helper function to create or find existing media record
 */
async function createOrFindMedia(
  mediaSourceId: string,
  newMedia: AddMediaRequest
): Promise<Media> {
  try {
    const insertedMedia = await MediaRepository.create(newMedia);
    logger.info(
      { mediaId: insertedMedia.id, filePath: newMedia.filePath },
      "Media registered successfully"
    );
    return insertedMedia;
  } catch (error) {
    // Handle race condition with FileWatcherService or concurrent registrations
    const existing = await MediaRepository.findByPath(
      mediaSourceId,
      newMedia.filePath
    );
    if (existing) {
      logger.info(
        { mediaId: existing.id, filePath: newMedia.filePath },
        "Media already exists, using existing record"
      );

      // Update description if we have one and existing doesn't (or overwrite)
      if (newMedia.description) {
        await MediaRepository.update(existing.id, {
          description: newMedia.description,
        });
      }
      return existing;
    }

    logger.error(
      { err: error, mediaSourceId, filePath: newMedia.filePath },
      "Failed to register media"
    );
    throw error;
  }
}

/**
 * Helper function to register URLs for a media
 */
async function registerUrls(
  mediaId: string,
  sourceUrls?: string[]
): Promise<void> {
  if (sourceUrls && sourceUrls.length > 0) {
    try {
      await MediaRepository.addUrls(mediaId, sourceUrls);
      logger.debug({ mediaId, urlCount: sourceUrls.length }, "URLs registered");
    } catch (error) {
      logger.error({ err: error, mediaId }, "Failed to register URLs");
      // Continue processing even if URL registration fails
    }
  }
}

/**
 * Helper function to register authors for a media
 */
async function registerAuthors(
  mediaId: string,
  authors?: AuthorData[]
): Promise<void> {
  if (authors && authors.length > 0) {
    try {
      for (const authorData of authors) {
        const newAuthor: NewAuthor = {
          name: authorData.name,
          accountId: authorData.accountId,
        };
        const author = await AuthorRepository.create(newAuthor);
        await AuthorRepository.addMedia(mediaId, author.id);
      }
      logger.debug(
        { mediaId, authorCount: authors.length },
        "Authors registered"
      );
    } catch (error) {
      logger.error({ err: error, mediaId }, "Failed to register authors");
      // Continue processing even if author registration fails
    }
  }
}

/**
 * Registers new media in the database and queues thumbnail and tag extraction jobs.
 *
 * This function centralizes the media registration workflow to ensure consistency
 * across different entry points (file watcher, downloads, manual uploads).
 *
 * Flow:
 * 1. Create media record in database
 * 2. Register source URLs (if provided)
 * 3. Register authors (if provided)
 * 4. Queue thumbnail and extractTags jobs
 * 5. Start job queue processing
 * 6. Send SSE notification
 *
 * Note: Metadata extraction is handled by the thumbnail job (processMediaJob),
 * not in this function, to avoid duplication.
 *
 * @param params - Registration parameters
 * @returns The registered media record
 */
export async function registerMediaWithJobs(
  params: RegisterMediaWithJobsParams
): Promise<Media> {
  const { mediaSourceId, newMedia, basePath, authors } = params;

  // Create or find existing media
  const insertedMedia = await createOrFindMedia(mediaSourceId, newMedia);

  // Register relations
  await registerUrls(insertedMedia.id, newMedia.sourceUrls);
  await registerAuthors(insertedMedia.id, authors);

  // Queue both thumbnail and extractTags jobs
  const jobs: Job[] = [
    {
      mediaId: insertedMedia.id,
      sourcePath: basePath,
      type: "thumbnail",
    },
    {
      mediaId: insertedMedia.id,
      sourcePath: basePath,
      type: "extractTags",
    },
  ];

  addJobsToQueue(mediaSourceId, jobs);
  startJobQueue(mediaSourceId, (job) => processMediaJob(job, mediaSourceId));

  logger.debug(
    { mediaId: insertedMedia.id, jobCount: jobs.length },
    "Jobs queued for processing"
  );

  // Notify success
  SseManager.sendEvent(mediaSourceId, "media-added", {
    mediaId: insertedMedia.id,
  });

  return insertedMedia;
}

/**
 * Updates media in the database and queues thumbnail and tag extraction jobs.
 *
 * This function is used when a file is modified and needs to be re-processed.
 *
 * Flow:
 * 1. Update media record in database
 * 2. Queue thumbnail and extractTags jobs
 * 3. Start job queue processing
 * 4. Send SSE notification
 *
 * @param params - Update parameters
 * @returns The updated media record
 */
export async function updateMediaWithJobs(
  params: UpdateMediaWithJobsParams
): Promise<Media> {
  const { mediaSourceId, mediaId, basePath, updates } = params;

  // Update media record
  await MediaRepository.update(mediaId, updates);

  const updatedMedia = await MediaRepository.findById(mediaId);
  if (!updatedMedia) {
    throw new Error(`Media not found: ${mediaId}`);
  }

  logger.info({ mediaId, updates }, "Media updated successfully");

  // Queue both thumbnail and extractTags jobs
  const jobs: Job[] = [
    {
      mediaId,
      sourcePath: basePath,
      type: "thumbnail",
    },
    {
      mediaId,
      sourcePath: basePath,
      type: "extractTags",
    },
  ];

  addJobsToQueue(mediaSourceId, jobs);
  startJobQueue(mediaSourceId, (job) => processMediaJob(job, mediaSourceId));

  logger.debug(
    { mediaId, jobCount: jobs.length },
    "Jobs queued for processing"
  );

  // Notify
  SseManager.sendEvent(mediaSourceId, "media-changed", {
    mediaId,
    filePath: updatedMedia.filePath,
  });

  return updatedMedia;
}

/**
 * Parameters for queuing generation jobs for multiple media
 */
export type QueueGenerationJobsParams = {
  mediaSourceId: string;
  items: { id: string; filePath: string }[];
  basePath: string;
  skipMetadataExtraction?: boolean;
};

/**
 * Queues generation jobs (thumbnail, extractTags) for multiple media items.
 * Designed for use after backup restoration or bulk import.
 *
 * @param params - Job generation parameters
 */
export function queueGenerationJobs(params: QueueGenerationJobsParams): void {
  const { mediaSourceId, items, basePath, skipMetadataExtraction } = params;

  if (items.length === 0) {
    return;
  }

  const jobs: Job[] = [];

  for (const item of items) {
    // Thumbnail job (with optional skipMetadataExtraction)
    jobs.push({
      mediaId: item.id,
      sourcePath: basePath,
      type: "thumbnail",
      options: {
        skipMetadataExtraction,
      },
    });

    // Extract tags job (only if NOT skipping metadata extraction)
    if (!skipMetadataExtraction) {
      jobs.push({
        mediaId: item.id,
        sourcePath: basePath,
        type: "extractTags",
      });
    }
  }

  addJobsToQueue(mediaSourceId, jobs);
  startJobQueue(mediaSourceId, (job) => processMediaJob(job, mediaSourceId));

  logger.info(
    { mediaSourceId, jobCount: jobs.length, skipMetadataExtraction },
    "Queued generation jobs for restored media"
  );
}
