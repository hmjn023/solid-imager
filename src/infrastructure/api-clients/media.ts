import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { z } from "zod";
import {
  addMediaRequestSchema,
  directoryPathSchema,
  mediaIdSchema,
  updateMediaRequestSchema,
} from "~/domain/media/schemas";
import { sourceIdSchema } from "~/domain/sources/schemas";
import {
  deleteMedia as dbDeleteMedia,
  updateMedia as dbUpdateMedia,
  insertMedia,
  selectMediaById,
  selectMediaBySourceIdAndDirectoryPath,
  selectMediaBySourceIdAndFilePath,
} from "~/infrastructure/db/media";
import type { Media, NewMedia } from "~/infrastructure/db/schema";

type AddMediaRequest = z.infer<typeof addMediaRequestSchema>;

export async function addMedia(data: AddMediaRequest): Promise<Media> {
  const validatedData = addMediaRequestSchema.parse(data);
  const existingMedia = await selectMediaBySourceIdAndFilePath(
    validatedData.sourceId,
    validatedData.filePath
  );

  if (existingMedia.length > 0) {
    throw new Error(
      "Media with this filePath already exists for the given sourceId"
    );
  }

  const newMedia: NewMedia = {
    sourceId: validatedData.sourceId,
    filePath: validatedData.filePath,
    fileName: validatedData.fileName,
    mediaType: validatedData.mediaType,
    width: validatedData.width,
    height: validatedData.height,
    fileSize: validatedData.size,
  };
  const result = await insertMedia(newMedia);
  if (result.length === 0) {
    throw new Error("Failed to insert media into database");
  }

  return result[0];
}

export async function getMedia(
  sourceId: string,
  mediaId: string
): Promise<Media> {
  const validatedSourceId = sourceIdSchema.parse(sourceId);
  const validatedMediaId = mediaIdSchema.parse(mediaId);
  const result = await selectMediaById(validatedMediaId);

  if (result.sourceId !== validatedSourceId) {
    throw new Error("Media not found");
  }

  return result;
}

type UpdateMediaRequest = z.infer<typeof updateMediaRequestSchema>;

export async function updateMedia(
  sourceId: string,
  mediaId: string,
  updates: UpdateMediaRequest
): Promise<Media> {
  const validatedUpdates = updateMediaRequestSchema.parse(updates);
  const validatedSourceId = sourceIdSchema.parse(sourceId);
  const validatedMediaId = mediaIdSchema.parse(mediaId);
  const existingMedia = await selectMediaById(validatedMediaId);
  if (existingMedia.sourceId !== validatedSourceId) {
    throw new Error("Media not found");
  }

  const updatedMediaData = {
    ...existingMedia,
    ...validatedUpdates,
    updatedAt: new Date(),
  };
  const result = await dbUpdateMedia(validatedMediaId, updatedMediaData);

  if (result.length === 0) {
    throw new Error("Media not found or failed to update");
  }

  return result[0];
}

export async function deleteMedia(
  sourceId: string,
  mediaId: string
): Promise<{ success: boolean }> {
  const validatedSourceId = sourceIdSchema.parse(sourceId);
  const validatedMediaId = mediaIdSchema.parse(mediaId);
  const existingMedia = await selectMediaById(validatedMediaId);
  if (existingMedia.sourceId !== validatedSourceId) {
    throw new Error("Media not found");
  }
  const result = await dbDeleteMedia(validatedMediaId);

  if (result.length === 0) {
    throw new Error("Media not found or failed to delete");
  }

  // サムネイルも非同期で削除します。
  try {
    await deleteThumbnail(validatedMediaId);
  } catch (_error) {}

  return { success: true };
}

import {
  addJobsToQueue,
  startJobQueue,
} from "~/infrastructure/jobs/thumbnail-jobs";
import {
  deleteThumbnail,
  generateThumbnail,
} from "~/infrastructure/jobs/thumbnails";

const SUPPORTED_MEDIA_TYPES = ["png", "jpg", "jpeg", "webp", "gif"];

async function getFiles(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name);
      return dirent.isDirectory() ? getFiles(res) : res;
    })
  );
  return Array.prototype.concat(...files);
}

export async function registerExistingMedia(
  sourceId: string,
  basePath: string
): Promise<{ added: number; skipped: number; failed: number }> {
  const validatedSourceId = sourceIdSchema.parse(sourceId);

  let allFiles: string[] = [];
  try {
    allFiles = await getFiles(basePath);
  } catch (_error) {
    return { added: 0, skipped: 0, failed: allFiles.length };
  }

  const mediaFiles = allFiles.filter((file) => {
    const ext = path.extname(file).substring(1).toLowerCase();
    return SUPPORTED_MEDIA_TYPES.includes(ext);
  });

  const addedMedia: Media[] = [];
  let skipped = 0;
  let failed = 0;

  for (const fullPath of mediaFiles) {
    try {
      const relativePath = path.relative(basePath, fullPath);
      const existingMedia = await selectMediaBySourceIdAndFilePath(
        validatedSourceId,
        relativePath
      );

      if (existingMedia.length > 0) {
        skipped++;
        continue;
      }

      const stats = await fs.stat(fullPath);
      const metadata = await sharp(fullPath).metadata();

      if (!(metadata.width && metadata.height)) {
        failed++;
        continue;
      }

      const newMedia: NewMedia = {
        sourceId: validatedSourceId,
        filePath: relativePath,
        fileName: path.basename(fullPath),
        mediaType: "image",
        width: metadata.width,
        height: metadata.height,
        fileSize: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      };
      const [inserted] = await insertMedia(newMedia);
      addedMedia.push(inserted);
    } catch (_error) {
      failed++;
    }
  }

  if (addedMedia.length > 0) {
    const jobs = addedMedia.map((media) => ({
      mediaId: media.id,
      sourcePath: basePath,
    }));
    addJobsToQueue(validatedSourceId, jobs);
    startJobQueue(validatedSourceId, async (job) => {
      const media = addedMedia.find((m) => m.id === job.mediaId);
      if (media) {
        await generateThumbnail(media, job.sourcePath);
      }
    });
  }

  return { added: addedMedia.length, skipped, failed };
}

export async function listMedia(
  sourceId: string,
  directoryPath: string
): Promise<Media[]> {
  const validatedSourceId = sourceIdSchema.parse(sourceId);
  const validatedDirectoryPath = directoryPathSchema.parse(directoryPath);
  const result = await selectMediaBySourceIdAndDirectoryPath(
    validatedSourceId,
    validatedDirectoryPath
  );

  return result;
}

export function getMediaDetails(
  sourceId: string,
  mediaId: string
): Promise<Media> {
  return getMedia(sourceId, mediaId);
}

export async function getMediaMetadata(
  sourceId: string,
  mediaId: string
): Promise<Record<string, unknown>> {
  const media = await getMedia(sourceId, mediaId);
  return { mediaId: media.id, metadata: {} };
}

export async function getMediaTags(
  sourceId: string,
  mediaId: string
): Promise<unknown[]> {
  const _media = await getMedia(sourceId, mediaId);
  return [];
}

export function getMediaThumbnail(
  _sourceId: string,
  _mediaId: string
): Promise<Buffer> {
  throw new Error("Not implemented");
}

export function uploadMedia(
  _sourceId: string,
  _uploadData: unknown
): Promise<Media> {
  throw new Error("Not implemented");
}

export function searchMediaInDirectory(
  sourceId: string,
  directoryPath: string,
  _searchOptions: unknown
): Promise<Media[]> {
  return listMedia(sourceId, directoryPath);
}

export function searchMedia(
  _sourceId: string,
  _searchOptions: unknown
): Promise<Media[]> {
  return [];
}
