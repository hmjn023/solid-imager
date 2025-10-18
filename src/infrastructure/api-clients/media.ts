import { promises as fs } from "node:fs";
import path from "node:path";
import { Effect, Option } from "effect";
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

export function addMedia(data: AddMediaRequest) {
  return Effect.gen(function* (_) {
    const validatedData = addMediaRequestSchema.parse(data);
    const existingMedia = yield* _(
      Effect.option(
        selectMediaBySourceIdAndFilePath(
          validatedData.sourceId,
          validatedData.filePath
        )
      )
    );

    if (Option.isSome(existingMedia)) {
      return yield* _(
        Effect.fail(
          new Error(
            "Media with this filePath already exists for the given sourceId"
          )
        )
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
    const result = yield* _(insertMedia(newMedia));
    if (result.length === 0) {
      return yield* _(
        Effect.fail(new Error("Failed to insert media into database"))
      );
    }

    return result[0];
  });
}

export function getMedia(sourceId: string, mediaId: string) {
  return Effect.gen(function* (_) {
    const validatedSourceId = sourceIdSchema.parse(sourceId);
    const validatedMediaId = mediaIdSchema.parse(mediaId);
    const result = yield* _(selectMediaById(validatedMediaId));

    if (result.sourceId !== validatedSourceId) {
      return yield* _(Effect.fail(new Error("Media not found")));
    }

    return result;
  });
}

type UpdateMediaRequest = z.infer<typeof updateMediaRequestSchema>;

export function updateMedia(
  sourceId: string,
  mediaId: string,
  updates: UpdateMediaRequest
) {
  return Effect.gen(function* (_) {
    const validatedUpdates = updateMediaRequestSchema.parse(updates);
    const validatedSourceId = sourceIdSchema.parse(sourceId);
    const validatedMediaId = mediaIdSchema.parse(mediaId);
    const existingMedia = yield* _(selectMediaById(validatedMediaId));
    if (existingMedia.sourceId !== validatedSourceId) {
      return yield* _(Effect.fail(new Error("Media not found")));
    }

    const updatedMediaData = {
      ...existingMedia,
      ...validatedUpdates,
      updatedAt: new Date(),
    };
    const result = yield* _(dbUpdateMedia(validatedMediaId, updatedMediaData));

    if (result.length === 0) {
      return yield* _(
        Effect.fail(new Error("Media not found or failed to update"))
      );
    }

    return result[0];
  });
}

export function deleteMedia(sourceId: string, mediaId: string) {
  return Effect.gen(function* (_) {
    const validatedSourceId = sourceIdSchema.parse(sourceId);
    const validatedMediaId = mediaIdSchema.parse(mediaId);
    const existingMedia = yield* _(selectMediaById(validatedMediaId));
    if (existingMedia.sourceId !== validatedSourceId) {
      return yield* _(Effect.fail(new Error("Media not found")));
    }
    const result = yield* _(dbDeleteMedia(validatedMediaId));

    if (result.length === 0) {
      return yield* _(
        Effect.fail(new Error("Media not found or failed to delete"))
      );
    }

    // サムネイルも非同期で削除します。
    yield* _(
      Effect.promise(() => deleteThumbnail(validatedMediaId)).pipe(
        Effect.catchAll(() => Effect.succeed(undefined)) // Ignore error if thumbnail does not exist
      )
    );

    return { success: true };
  });
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

export function registerExistingMedia(sourceId: string, basePath: string) {
  return Effect.gen(function* (_) {
    const validatedSourceId = sourceIdSchema.parse(sourceId);

    const allFiles = yield* _(Effect.tryPromise(() => getFiles(basePath)));
    const mediaFiles = allFiles.filter((file) => {
      const ext = path.extname(file).substring(1).toLowerCase();
      return SUPPORTED_MEDIA_TYPES.includes(ext);
    });

    const addedMedia: Media[] = [];
    let skipped = 0;
    let failed = 0;

    for (const fullPath of mediaFiles) {
      const processFile = Effect.gen(function* (_effect) {
        const relativePath = path.relative(basePath, fullPath);
        const existingMedia = yield* _(
          Effect.option(
            selectMediaBySourceIdAndFilePath(validatedSourceId, relativePath)
          )
        );

        if (Option.isSome(existingMedia)) {
          skipped++;
          return;
        }

        const stats = yield* _(Effect.tryPromise(() => fs.stat(fullPath)));
        const metadata = yield* _(
          Effect.tryPromise(() => sharp(fullPath).metadata())
        );

        if (!(metadata.width && metadata.height)) {
          failed++;
          return;
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
        const [inserted] = yield* _(insertMedia(newMedia));
        addedMedia.push(inserted);
      });

      const result = yield* _(Effect.either(processFile));
      if (result._tag === "Left") {
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
  });
}

export function listMedia(sourceId: string, directoryPath: string) {
  return Effect.gen(function* (_) {
    const validatedSourceId = sourceIdSchema.parse(sourceId);
    const validatedDirectoryPath = directoryPathSchema.parse(directoryPath);
    const result = yield* _(
      selectMediaBySourceIdAndDirectoryPath(
        validatedSourceId,
        validatedDirectoryPath
      )
    );

    return result;
  });
}

export function getMediaDetails(
  sourceId: string,
  mediaId: string
): Promise<Media> {
  return Effect.runPromise(getMedia(sourceId, mediaId));
}

export async function getMediaMetadata(
  sourceId: string,
  mediaId: string
): Promise<Record<string, unknown>> {
  const media = await Effect.runPromise(getMedia(sourceId, mediaId));
  return { mediaId: media.id, metadata: {} };
}

export async function getMediaTags(
  sourceId: string,
  mediaId: string
): Promise<unknown[]> {
  const _media = await Effect.runPromise(getMedia(sourceId, mediaId));
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
  return Effect.runPromise(listMedia(sourceId, directoryPath));
}

export function searchMedia(
  _sourceId: string,
  _searchOptions: unknown
): Promise<Media[]> {
  return [];
}
