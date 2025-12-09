import { and, eq, inArray } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import {
  type Media,
  medias,
  mediaTags,
  type NewMediaTag,
} from "~/infrastructure/db/schema";
import { ConstraintError, UnknownDbError } from "../errors";

/**
 * Performs a bulk update on multiple media items.
 * @param {string} mediaSourceId - The ID of the media source.
 * @param {string[]} mediaIds - An array of media IDs to update.
 * @param {Partial<Media>} updates - The partial media object with fields to update.
 * @returns {Promise<Media[]>} A promise that resolves with an array of the updated media items.
 * @throws {UnknownDbError} If a database error occurs during the update.
 */
export const bulkUpdateMedia = async (
  mediaSourceId: string,
  mediaIds: string[],
  updates: Partial<Media>
) => {
  try {
    return await db
      .update(medias)
      .set(updates)
      .where(
        and(
          eq(medias.mediaSourceId, mediaSourceId),
          inArray(medias.id, mediaIds)
        )
      )
      .returning();
  } catch (error) {
    throw new UnknownDbError({
      message: `Failed to bulk update media for source ID: ${mediaSourceId}`,
      details: error,
    });
  }
};

/**
 * Performs a bulk delete operation on multiple media items.
 * @param {string} mediaSourceId - The ID of the media source.
 * @param {string[]} mediaIds - An array of media IDs to delete.
 * @returns {Promise<Media[]>} A promise that resolves with an array of the deleted media items.
 * @throws {UnknownDbError} If a database error occurs during the deletion.
 */
export const bulkDeleteMedia = async (
  mediaSourceId: string,
  mediaIds: string[]
) => {
  try {
    return await db
      .delete(medias)
      .where(
        and(
          eq(medias.mediaSourceId, mediaSourceId),
          inArray(medias.id, mediaIds)
        )
      )
      .returning();
  } catch (error) {
    throw new UnknownDbError({
      message: `Failed to bulk delete media for source ID: ${mediaSourceId}`,
      details: error,
    });
  }
};

/**
 * Performs a bulk update on the file paths of multiple media items.
 * This is typically used for moving media to a new directory.
 * @param {string} mediaSourceId - The ID of the media source.
 * @param {string[]} mediaIds - An array of media IDs whose paths are to be updated.
 * @param {string} pathUpdates - The new base path for the media files.
 * @returns {Promise<any[]>} A promise that resolves when all paths have been updated.
 * @throws {UnknownDbError} If a database error occurs during the update.
 */
export const bulkUpdateMediaPaths = async (
  mediaSourceId: string,
  mediaIds: string[],
  pathUpdates: string
) => {
  try {
    return await db.transaction(async (tx) => {
      const mediaToUpdate = await tx
        .select({ id: medias.id, fileName: medias.fileName })
        .from(medias)
        .where(
          and(
            eq(medias.mediaSourceId, mediaSourceId),
            inArray(medias.id, mediaIds)
          )
        );

      const updates = mediaToUpdate.map((media) => {
        const newFilePath = `${pathUpdates}/${media.fileName}`;
        return tx
          .update(medias)
          .set({ filePath: newFilePath })
          .where(eq(medias.id, media.id));
      });

      return Promise.all(updates);
    });
  } catch (error) {
    throw new UnknownDbError({
      message: `Failed to bulk update media paths for source ID: ${mediaSourceId}`,
      details: error,
    });
  }
};

/**
 * Performs a bulk operation to add tags to multiple media items.
 * @param {string} _mediaSourceId - The ID of the media source (currently unused but kept for consistency).
 * @param {string[]} mediaIds - An array of media IDs to add tags to.
 * @param {number[]} tagsToAdd - An array of tag IDs to add.
 * @returns {Promise<NewMediaTag[]>} A promise that resolves with an array of the newly created media tag relationships.
 * @throws {ConstraintError} If one or more media tags already exist (due to unique constraint).
 * @throws {UnknownDbError} If a database error occurs during the insertion.
 */
export const bulkAddMediaTags = async (
  _mediaSourceId: string,
  mediaIds: string[],
  tagsToAdd: number[]
) => {
  const values: NewMediaTag[] = [];
  for (const mediaId of mediaIds) {
    for (const tagId of tagsToAdd) {
      values.push({ mediaId, tagId, tagType: "positive", source: "manual" });
    }
  }

  if (values.length === 0) {
    return [];
  }

  try {
    return await db.insert(mediaTags).values(values).returning();
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ConstraintError({
        message: "One or more media tags already exist",
        details: error,
      });
    }
    throw new UnknownDbError({
      message: "Failed to bulk add media tags",
      details: error,
    });
  }
};

/**
 * Performs a bulk operation to remove tags from multiple media items.
 * @param {string} _mediaSourceId - The ID of the media source (currently unused but kept for consistency).
 * @param {string[]} mediaIds - An array of media IDs to remove tags from.
 * @param {number[]} tagsToRemove - An array of tag IDs to remove.
 * @returns {Promise<NewMediaTag[]>} A promise that resolves with an array of the removed media tag relationships.
 * @throws {UnknownDbError} If a database error occurs during the deletion.
 */
export const bulkRemoveMediaTags = async (
  _mediaSourceId: string,
  mediaIds: string[],
  tagsToRemove: number[]
) => {
  if (mediaIds.length === 0 || tagsToRemove.length === 0) {
    return [];
  }

  try {
    return await db
      .delete(mediaTags)
      .where(
        and(
          inArray(mediaTags.mediaId, mediaIds),
          inArray(mediaTags.tagId, tagsToRemove)
        )
      )
      .returning();
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to bulk remove media tags",
      details: error,
    });
  }
};
