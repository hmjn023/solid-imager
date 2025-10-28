import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { z } from "zod";
import {
  addMediaRequestSchema,
  type conflictSchema,
  directoryPathSchema,
  mediaIdSchema,
  updateMediaRequestSchema,
  uploadRequestSchema,
  uploadResponseSchema,
} from "~/domain/media/schemas";
import { sourceIdSchema } from "~/domain/sources/schemas";
import {
  deleteMedia as dbDeleteMedia,
  updateMedia as dbUpdateMedia,
  insertMedia,
  selectMediaById,
  selectMediaBySourceId,
  selectMediaBySourceIdAndDirectoryPath,
  selectMediaBySourceIdAndFilePath,
} from "~/infrastructure/db/queries/media";
import { selectMediaSourceById } from "~/infrastructure/db/queries/media-sources";
import type { Media, NewMedia } from "~/infrastructure/db/schema";

type AddMediaRequest = z.infer<typeof addMediaRequestSchema>;

/**
 * Adds a new media entry to the database.
 * @param {AddMediaRequest} data - The data for the new media entry.
 * @returns {Promise<Media>} A promise that resolves with the newly created media object.
 * @throws {Error} If media with the same file path already exists for the given source ID.
 */
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
    description: validatedData.description,
    sourceUrl: validatedData.sourceUrl,
    width: validatedData.width,
    height: validatedData.height,
    fileSize: validatedData.size,
  };
  const result = await insertMedia(newMedia);
  return result;
}

/**
 * Retrieves a specific media item by its source ID and media ID.
 * @param {string} sourceId - The ID of the media source.
 * @param {string} mediaId - The ID of the media item.
 * @returns {Promise<Media>} A promise that resolves with the media object.
 * @throws {Error} If the media is not found or does not belong to the specified source.
 */
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

/**
 * Updates an existing media item.
 * @param {string} sourceId - The ID of the media source.
 * @param {string} mediaId - The ID of the media item to update.
 * @param {UpdateMediaRequest} updates - The updates to apply to the media item.
 * @returns {Promise<Media>} A promise that resolves with the updated media object.
 * @throws {Error} If the media is not found or does not belong to the specified source.
 */
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
    modifiedAt: new Date(),
  };
  const result = await dbUpdateMedia(validatedMediaId, updatedMediaData);
  return result;
}

/**
 * Deletes a media item from the database and attempts to delete its thumbnail.
 * @param {string} sourceId - The ID of the media source.
 * @param {string} mediaId - The ID of the media item to delete.
 * @returns {Promise<{ success: boolean }>} A promise that resolves with a success status.
 * @throws {Error} If the media is not found or does not belong to the specified source.
 */
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
  await dbDeleteMedia(validatedMediaId);

  // サムネイルも非同期で削除します。
  try {
    await deleteThumbnail(validatedSourceId, validatedMediaId);
  } catch (_error) {
    // サムネイル削除のエラーは無視（メディア削除は成功）
  }

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

/**
 * Recursively retrieves a list of all files within a given directory.
 * @param {string} dir - The directory path to scan.
 * @returns {Promise<string[]>} A promise that resolves with an array of absolute file paths.
 */
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

/**
 * Registers existing media files from a given base path into the database.
 * It filters for supported media types, checks for existing entries, and generates thumbnails for new media.
 * @param {string} sourceId - The ID of the media source.
 * @param {string} basePath - The base path where media files are located.
 * @returns {Promise<{ added: number; skipped: number; failed: number }>} A promise that resolves with counts of added, skipped, and failed media.
 */
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
        description: "",
        sourceUrl: "",
        width: metadata.width,
        height: metadata.height,
        fileSize: stats.size,
      };
      const inserted = await insertMedia(newMedia);
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
        await generateThumbnail(media, job.sourcePath, validatedSourceId);
      }
    });
  }

  return { added: addedMedia.length, skipped, failed };
}

/**
 * Lists media items within a specific directory of a media source.
 * @param {string} sourceId - The ID of the media source.
 * @param {string} directoryPath - The path to the directory to list media from.
 * @returns {Promise<Media[]>} A promise that resolves with an array of media objects.
 */
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

/**
 * Retrieves detailed information for a specific media item.
 * This function currently delegates to `getMedia`.
 * @param {string} sourceId - The ID of the media source.
 * @param {string} mediaId - The ID of the media item.
 * @returns {Promise<Media>} A promise that resolves with the detailed media object.
 */
export function getMediaDetails(
  sourceId: string,
  mediaId: string
): Promise<Media> {
  return getMedia(sourceId, mediaId);
}

/**
 * Retrieves metadata for a specific media item.
 * @param {string} sourceId - The ID of the media source.
 * @param {string} mediaId - The ID of the media item.
 * @returns {Promise<Record<string, unknown>>} A promise that resolves with a record of metadata.
 */
export async function getMediaMetadata(
  sourceId: string,
  mediaId: string
): Promise<Record<string, unknown>> {
  const media = await getMedia(sourceId, mediaId);
  return { mediaId: media.id, metadata: {} };
}

/**
 * Retrieves tags associated with a specific media item.
 * @param {string} sourceId - The ID of the media source.
 * @param {string} mediaId - The ID of the media item.
 * @returns {Promise<unknown[]>} A promise that resolves with an array of tags.
 */
export async function getMediaTags(
  sourceId: string,
  mediaId: string
): Promise<unknown[]> {
  const _media = await getMedia(sourceId, mediaId);
  return [];
}

/**
 * Retrieves the thumbnail for a specific media item.
 * @param {string} _sourceId - The ID of the media source.
 * @param {string} _mediaId - The ID of the media item.
 * @returns {Promise<Buffer>} A promise that resolves with the thumbnail data as a Buffer.
 */
export function getMediaThumbnail(
  _sourceId: string,
  _mediaId: string
): Promise<Buffer> {
  throw new Error("Not implemented");
}

/**
 * Uploads a media file.
 * @param {string} sourceId - The ID of the media source.
 * @param {FormData} uploadData - The FormData object containing the file and other upload details.
 * @returns {Promise<z.infer<typeof uploadResponseSchema>>} A promise that resolves with the upload response.
 * @throws {Error} If the media source is not found, not local, or if there's a file conflict.
 */
export async function uploadMedia(
  sourceId: string,
  uploadData: FormData
): Promise<z.infer<typeof uploadResponseSchema>> {
  const validatedSourceId = sourceIdSchema.parse(sourceId);
  const mediaSource = await selectMediaSourceById(validatedSourceId);

  if (!mediaSource) {
    throw new Error("Media source not found.");
  }

  if (mediaSource.type !== "local") {
    throw new Error(
      "Only local media sources are supported for uploads in Phase 1."
    );
  }

  const connectionInfo = mediaSource.connectionInfo as { path: string };
  const basePath = connectionInfo.path;

  const file = uploadData.get("file") as File | null;
  if (!file) {
    throw new Error("No file provided for upload.");
  }

  const uploadRequest = uploadRequestSchema.parse({
    filename: uploadData.get("filename")?.toString(),
    autoIncrement: uploadData.get("autoIncrement")?.toString(),
    description: uploadData.get("description")?.toString(),
    sourceUrl: uploadData.get("sourceUrl")?.toString(),
    overwrite: uploadData.get("overwrite")?.toString(),
  });

  let targetFileName = uploadRequest.filename || file.name;
  let targetFilePath = path.join(basePath, targetFileName);
  let relativeFilePath = path.relative(basePath, targetFilePath);
  let conflict: z.infer<typeof conflictSchema> | undefined;

  // Handle file name conflicts
  let counter = 0;
  while (
    await fs
      .stat(targetFilePath)
      .then(() => true)
      .catch(() => false)
  ) {
    if (uploadRequest.overwrite) {
      break; // Overwrite existing file
    }

    if (!uploadRequest.autoIncrement) {
      conflict = {
        existingFile: relativeFilePath,
        suggestedName: "", // Will be filled if autoIncrement is true
      };
      throw new Error("File already exists and overwrite is not allowed.");
    }

    counter++;
    const ext = path.extname(file.name);
    const base = path.basename(file.name, ext);
    targetFileName = `${base}_${counter}${ext}`;
    targetFilePath = path.join(basePath, targetFileName);
    relativeFilePath = path.relative(basePath, targetFilePath);
    conflict = {
      existingFile: path.relative(
        basePath,
        path.join(basePath, uploadRequest.filename || file.name)
      ),
      suggestedName: targetFileName,
    };
  }

  // Save the file
  await fs.writeFile(targetFilePath, Buffer.from(await file.arrayBuffer()));

  // Extract metadata
  const stats = await fs.stat(targetFilePath);
  const metadata = await sharp(targetFilePath).metadata();

  if (!(metadata.width && metadata.height)) {
    await fs.unlink(targetFilePath); // Clean up if metadata extraction fails
    throw new Error("Could not extract media dimensions.");
  }

  const newMedia: NewMedia = {
    sourceId: validatedSourceId,
    filePath: relativeFilePath,
    fileName: targetFileName,
    mediaType: "image", // Assuming image for now, will need to determine based on file type
    description: uploadRequest.description || "",
    sourceUrl: uploadRequest.sourceUrl || "",
    width: metadata.width,
    height: metadata.height,
    fileSize: stats.size,
  };
  const insertedMedia = await insertMedia(newMedia);

  // Trigger thumbnail generation
  addJobsToQueue(validatedSourceId, [
    { mediaId: insertedMedia.id, sourcePath: basePath },
  ]);
  startJobQueue(validatedSourceId, async (job) => {
    const media = await selectMediaById(job.mediaId);
    if (media) {
      await generateThumbnail(media, job.sourcePath, validatedSourceId);
    }
  });

  return uploadResponseSchema.parse({
    success: true,
    filePath: relativeFilePath,
    conflict,
  });
}

/**
 * Searches for media within a specific directory of a media source.
 * This function currently delegates to `listMedia`.
 * @param {string} sourceId - The ID of the media source.
 * @param {string} directoryPath - The path to the directory to search within.
 * @param {unknown} _searchOptions - Search options (currently unused, delegates to listMedia).
 * @returns {Promise<Media[]>} A promise that resolves with an array of media objects.
 */
export function searchMediaInDirectory(
  sourceId: string,
  directoryPath: string,
  _searchOptions: unknown
): Promise<Media[]> {
  return listMedia(sourceId, directoryPath);
}

/**
 * Searches for media across a specific media source.
 * @param {string} _sourceId - The ID of the media source.
 * @param {unknown} _searchOptions - Search options.
 * @returns {Promise<Media[]>} A promise that resolves with an array of media objects.
 */
export function searchMedia(
  _sourceId: string,
  _searchOptions: unknown
): Promise<Media[]> {
  return [];
}

/**
 * Retrieves all media items for a specific media source.
 * @param {string} sourceId - The ID of the media source.
 * @returns {Promise<Media[]>} A promise that resolves with an array of media objects.
 */
export async function getAllMedia(sourceId: string): Promise<Media[]> {
  const validatedSourceId = sourceIdSchema.parse(sourceId);
  const result = await selectMediaBySourceId(validatedSourceId);
  return result;
}
