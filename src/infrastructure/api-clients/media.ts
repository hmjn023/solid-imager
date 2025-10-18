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
} from "~/infrastructure/db";
import type { Media, NewMedia } from "~/infrastructure/db/schema";

type AddMediaRequest = z.infer<typeof addMediaRequestSchema>;

/**
 * 新しいメディアエントリをデータベースに追加します。
 * @param data - 追加するメディアのデータ。
 * @returns 追加されたメディアオブジェクト。
 * @throws {Error} 必須フィールドが不足している場合、またはデータベースへの挿入に失敗した場合。
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
    width: validatedData.width,
    height: validatedData.height,
    fileSize: validatedData.size,
  };

  // TODO: 実際のファイルシステム操作（例: ファイルの保存）を実装する
  // ファイルシステム操作が権限の問題で失敗した場合、ここでエラーをスローする
  // 例: try { await fs.writeFile(data.filePath, fileContent); } catch (fsError) { throw new Error('ファイルシステムアクセスが拒否されました'); }

  const result = await insertMedia(newMedia);
  if (result.length === 0) {
    throw new Error("Failed to insert media into database");
  }

  return result[0];
}

/**
 * 指定されたIDのメディアエントリをデータベースから取得します。
 * @param mediaId - 取得するメディアのUUID。
 * @returns 取得されたメディアオブジェクト。
 * @throws {Error} mediaIdが不足している場合、フォーマットが無効な場合、またはメディアが見つからない場合。
 */
export async function getMedia(
  sourceId: string,
  mediaId: string
): Promise<Media> {
  const validatedSourceId = sourceIdSchema.parse(sourceId);
  const validatedMediaId = mediaIdSchema.parse(mediaId);

  const result = await selectMediaById(validatedMediaId);

  if (result.length === 0 || result[0].sourceId !== validatedSourceId) {
    throw new Error("Media not found");
  }

  return result[0];
}

type UpdateMediaRequest = z.infer<typeof updateMediaRequestSchema>;

/**
 * 指定されたIDのメディアエントリをデータベースで更新します。
 * @param mediaId - 更新するメディアのUUID。
 * @param updates - 更新するフィールドと値を含むオブジェクト。
 * @returns 更新されたメディアオブジェクト。
 * @throws {Error} mediaIdが不足している場合、フォーマットが無効な場合、更新データが提供されない場合、またはメディアが見つからない場合。
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
  if (
    existingMedia.length === 0 ||
    existingMedia[0].sourceId !== validatedSourceId
  ) {
    throw new Error("Media not found");
  }

  const updatedMediaData = {
    ...existingMedia[0],
    ...validatedUpdates,
    updatedAt: new Date(),
  };

  const result = await dbUpdateMedia(validatedMediaId, updatedMediaData);

  if (result.length === 0) {
    throw new Error("Media not found or failed to update");
  }

  return result[0];
}

/**
 * 指定されたIDのメディアエントリをデータベースから削除します。
 * @param mediaId - 削除するメディアのUUID。
 * @returns 成功を示すオブジェクト。
 * @throws {Error} mediaIdが不足している場合、フォーマットが無効な場合、またはメディアが見つからない場合。
 */
export async function deleteMedia(
  sourceId: string,
  mediaId: string
): Promise<{ success: boolean }> {
  const validatedSourceId = sourceIdSchema.parse(sourceId);
  const validatedMediaId = mediaIdSchema.parse(mediaId);

  const existingMedia = await selectMediaById(validatedMediaId);
  if (
    existingMedia.length === 0 ||
    existingMedia[0].sourceId !== validatedSourceId
  ) {
    throw new Error("Media not found");
  }

  const result = await dbDeleteMedia(validatedMediaId);

  if (result.length === 0) {
    throw new Error("Media not found or failed to delete");
  }

  // サムネイルも非同期で削除します。
  deleteThumbnail(validatedMediaId).catch((_err) => {
    /* Ignore error if thumbnail does not exist */
  });

  // TODO: 実際のファイルシステム操作（例: ファイルの削除）を実装する
  // ファイルシステム操作が権限の問題で失敗した場合、ここでエラーをスローする
  // 例: try { await fs.unlink(result[0].filePath); } catch (fsError) { throw new Error('ファイルシステムアクセスが拒否されました'); }

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

/**
 * Scans a directory for media files and registers them in the database if they don't already exist.
 * @param sourceId - The UUID of the media source.
 * @param basePath - The absolute path of the media source directory.
 * @returns An object with the count of added and skipped media.
 */
export async function registerExistingMedia(
  sourceId: string,
  basePath: string
): Promise<{ added: number; skipped: number; failed: number }> {
  const validatedSourceId = sourceIdSchema.parse(sourceId);

  const allFiles = await getFiles(basePath);
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
        mediaType: "image", // 現時点では画像のみがサポートされています
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

  // 新しく追加されたすべてのメディアのサムネイル生成をキューに入れます。
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

/**
 * 指定されたディレクトリパス内のすべてのメディアエントリをデータベースから取得します。
 * @param directoryPath - メディアを一覧表示するディレクトリのパス。
 * @returns メディアオブジェクトの配列。
 * @throws {Error} directoryPathが不足している場合。
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
 * Get detailed information about a media including tags, metadata, etc.
 * @param sourceId - The UUID of the media source.
 * @param mediaId - The UUID of the media.
 * @returns Media details object.
 */
export function getMediaDetails(
  sourceId: string,
  mediaId: string
): Promise<Media> {
  // TODO: Implement full details with tags, metadata, categories, etc.
  return getMedia(sourceId, mediaId);
}

/**
 * Get metadata for a media (PNG tEXt chunks, EXIF, etc.)
 * @param sourceId - The UUID of the media source.
 * @param mediaId - The UUID of the media.
 * @returns Media metadata object.
 */
export async function getMediaMetadata(
  sourceId: string,
  mediaId: string
): Promise<Record<string, unknown>> {
  // TODO: Implement metadata extraction from PNG tEXt chunks
  const media = await getMedia(sourceId, mediaId);
  return { mediaId: media.id, metadata: {} };
}

/**
 * Get tags for a media
 */
export async function getMediaTags(
  sourceId: string,
  mediaId: string
): Promise<unknown[]> {
  // TODO: Implement tag retrieval
  const _media = await getMedia(sourceId, mediaId);
  return [];
}

/**
 * Get thumbnail for a media
 */
export function getMediaThumbnail(
  _sourceId: string,
  _mediaId: string
): Promise<Buffer> {
  // TODO: Implement thumbnail retrieval
  // NOTE: The actual implementation is in src/routes/api/sources/[sourceId]/media/[mediaId]/thumbnail.ts
  // This stub is kept for API consistency but is not currently used by any routes
  throw new Error("Not implemented");
}

/**
 * Upload media file
 */
export function uploadMedia(
  _sourceId: string,
  _uploadData: unknown
): Promise<Media> {
  // TODO: Implement media upload
  throw new Error("Not implemented");
}

/**
 * Search media within a directory
 */
export function searchMediaInDirectory(
  sourceId: string,
  directoryPath: string,
  _searchOptions: unknown
): Promise<Media[]> {
  // TODO: Implement directory search
  return listMedia(sourceId, directoryPath);
}

/**
 * Search media within a source
 */
export function searchMedia(
  _sourceId: string,
  _searchOptions: unknown
): Promise<Media[]> {
  // TODO: Implement search functionality
  return [];
}
