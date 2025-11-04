import { and, eq, like } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { type Media, medias, type NewMedia } from "~/infrastructure/db/schema";
import { NotFoundError, UnknownDbError } from "../errors";

/**
 * Inserts a new media item into the database.
 * @param {NewMedia} newMedia - The data for the new media item, excluding auto-generated fields.
 * @returns {Promise<Media>} A promise that resolves with the newly inserted media object.
 * @throws {UnknownDbError} If a database error occurs during the insertion.
 */
export const insertMedia = async (newMedia: NewMedia): Promise<Media> => {
  try {
    const result = await db.insert(medias).values(newMedia).returning();
    return result[0];
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to insert media",
      details: error,
    });
  }
};

/**
 * Selects media items by source ID and file path from the database.
 * @param {string} mediaSourceId - The ID of the media source.
 * @param {string} filePath - The file path of the media item.
 * @returns {Promise<Media[]>} A promise that resolves with an array of media objects matching the criteria.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
export const selectMediaBySourceIdAndFilePath = async (
  mediaSourceId: string,
  filePath: string
): Promise<Media[]> => {
  try {
    const result = await db
      .select({
        id: medias.id,
        mediaSourceId: medias.mediaSourceId,
        filePath: medias.filePath,
        fileName: medias.fileName,
        mediaType: medias.mediaType,
        width: medias.width,
        height: medias.height,
        fileSize: medias.fileSize,
        description: medias.description,
        sourceUrl: medias.sourceUrl,
        createdAt: medias.createdAt,
        modifiedAt: medias.modifiedAt,
        indexedAt: medias.indexedAt,
        status: medias.status,
      })
      .from(medias)
      .where(and(eq(medias.mediaSourceId, mediaSourceId), eq(medias.filePath, filePath)));
    return result;
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to select media by source ID and file path",
      details: error,
    });
  }
};

/**
 * Selects a media item by its ID from the database.
 * @param {string} id - The ID of the media item to select.
 * @returns {Promise<Media>} A promise that resolves with the media object.
 * @throws {NotFoundError} If no media with the given ID is found.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
export const selectMediaById = async (id: string): Promise<Media> => {
  try {
    const result = await db.select().from(medias).where(eq(medias.id, id));
    if (result.length === 0) {
      throw new NotFoundError({ message: `Media with ID ${id} not found` });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to select media by ID: ${id}`,
      details: error,
    });
  }
};

/**
 * Selects media items by source ID and directory path from the database.
 * @param {string} mediaSourceId - The ID of the media source.
 * @param {string} directoryPath - The directory path to search within.
 * @returns {Promise<Media[]>} A promise that resolves with an array of media objects within the specified directory.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
export const selectMediaBySourceIdAndDirectoryPath = async (
  mediaSourceId: string,
  directoryPath: string
): Promise<Media[]> => {
  try {
    const searchPath = `${directoryPath}%`;
    const result = await db
      .select()
      .from(medias)
      .where(
        and(eq(medias.mediaSourceId, mediaSourceId), like(medias.filePath, searchPath))
      );
    return result;
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to select media by source ID and directory path",
      details: error,
    });
  }
};

/**
 * Updates an existing media item in the database.
 * @param {string} id - The ID of the media item to update.
 * @param {Partial<Media>} updatedMedia - The partial media object with fields to update.
 * @returns {Promise<Media>} A promise that resolves with the updated media object.
 * @throws {NotFoundError} If no media with the given ID is found.
 * @throws {UnknownDbError} If a database error occurs during the update.
 */
export const updateMedia = async (
  id: string,
  updatedMedia: Partial<Media>
): Promise<Media> => {
  try {
    const result = await db
      .update(medias)
      .set(updatedMedia)
      .where(eq(medias.id, id))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError({ message: `Media with ID ${id} not found` });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to update media with ID: ${id}`,
      details: error,
    });
  }
};

/**
 * Deletes a media item from the database.
 * @param {string} id - The ID of the media item to delete.
 * @returns {Promise<Media>} A promise that resolves with the deleted media object.
 * @throws {NotFoundError} If no media with the given ID is found.
 * @throws {UnknownDbError} If a database error occurs during the deletion.
 */
export const deleteMedia = async (id: string): Promise<Media> => {
  try {
    const result = await db.delete(medias).where(eq(medias.id, id)).returning();
    if (result.length === 0) {
      throw new NotFoundError({ message: `Media with ID ${id} not found` });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to delete media with ID: ${id}`,
      details: error,
    });
  }
};

/**
 * Selects all media items associated with a specific source ID.
 * @param {string} mediaSourceId - The ID of the media source.
 * @returns {Promise<Media[]>} A promise that resolves with an array of media objects.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
export const selectMediaBySourceId = async (
  mediaSourceId: string
): Promise<Media[]> => {
  try {
    return await db.select().from(medias).where(eq(medias.mediaSourceId, mediaSourceId));
  } catch (error) {
    throw new UnknownDbError({
      message: `Failed to select medias by source ID: ${mediaSourceId}`,
      details: error,
    });
  }
};

/**
 * Deletes media items by source ID and directory path from the database.
 * @param {string} mediaSourceId - The ID of the media source.
 * @param {string} directoryPath - The directory path to delete media from.
 * @returns {Promise<Media[]>} A promise that resolves with an array of the deleted media objects.
 * @throws {UnknownDbError} If a database error occurs during the deletion.
 */
export const deleteMediaByPath = async (
  mediaSourceId: string,
  directoryPath: string
): Promise<Media[]> => {
  try {
    return await db
      .delete(medias)
      .where(
        and(
          eq(medias.mediaSourceId, mediaSourceId),
          like(medias.filePath, `${directoryPath}%`)
        )
      )
      .returning();
  } catch (error) {
    throw new UnknownDbError({
      message: `Failed to delete medias by path ${directoryPath} for source ID: ${mediaSourceId}`,
      details: error,
    });
  }
};
