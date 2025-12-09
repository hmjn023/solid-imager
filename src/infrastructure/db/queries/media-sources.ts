import { eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import {
  type MediaSource,
  mediaSources,
  type NewMediaSource,
} from "~/infrastructure/db/schema";
import { ConstraintError, NotFoundError, UnknownDbError } from "../errors";

/**
 * Selects all media sources from the database.
 * @returns {Promise<MediaSource[]>} A promise that resolves with an array of media source objects.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
export const selectMediaSources = async (): Promise<MediaSource[]> => {
  try {
    return await db.select().from(mediaSources);
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to select media sources",
      details: error,
    });
  }
};

/**
 * Selects a media source by its ID from the database.
 * @param {string} mediaSourceId - The ID of the media source to select.
 * @returns {Promise<MediaSource>} A promise that resolves with the media source object.
 * @throws {NotFoundError} If no media source with the given ID is found.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
export const selectMediaSourceById = async (
  mediaSourceId: string
): Promise<MediaSource> => {
  try {
    const result = await db
      .select()
      .from(mediaSources)
      .where(eq(mediaSources.id, mediaSourceId));
    if (result.length === 0) {
      throw new NotFoundError({
        message: `Media source with ID ${mediaSourceId} not found`,
      });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to select media source by ID: ${mediaSourceId}`,
      details: error,
    });
  }
};

/**
 * Inserts a new media source into the database.
 * @param {NewMediaSource} mediaSource - The data for the new media source.
 * @returns {Promise<MediaSource[]>} A promise that resolves with an array containing the newly inserted media source.
 * @throws {ConstraintError} If a media source with the same name or ID already exists.
 * @throws {UnknownDbError} If a database error occurs during the insertion.
 */
export const insertMediaSource = async (
  mediaSource: NewMediaSource
): Promise<MediaSource[]> => {
  try {
    return await db.insert(mediaSources).values(mediaSource).returning();
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ConstraintError({
        message: "Media source with this name or ID already exists",
        details: error,
      });
    }
    throw new UnknownDbError({
      message: "Failed to insert media source",
      details: error,
    });
  }
};

/**
 * Updates an existing media source in the database.
 * @param {string} mediaSourceId - The ID of the media source to update.
 * @param {MediaSource} mediaSource - The updated data for the media source.
 * @returns {Promise<MediaSource>} A promise that resolves with the updated media source object.
 * @throws {NotFoundError} If no media source with the given ID is found.
 * @throws {ConstraintError} If the update causes a unique constraint violation (e.g., duplicate name).
 * @throws {UnknownDbError} If a database error occurs during the update.
 */
export const updateMediaSource = async (
  mediaSourceId: string,
  mediaSource: Partial<MediaSource>
): Promise<MediaSource> => {
  try {
    const result = await db
      .update(mediaSources)
      .set(mediaSource)
      .where(eq(mediaSources.id, mediaSourceId))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError({
        message: `Media source with ID ${mediaSourceId} not found`,
      });
    }
    return result[0];
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ConstraintError({
        message: "Media source with this name or ID already exists",
        details: error,
      });
    }
    throw new UnknownDbError({
      message: "Failed to update media source",
      details: error,
    });
  }
};

/**
 * Deletes a media source from the database.
 * @param {string} mediaSourceId - The ID of the media source to delete.
 * @returns {Promise<MediaSource>} A promise that resolves with the deleted media source object.
 * @throws {NotFoundError} If no media source with the given ID is found.
 * @throws {UnknownDbError} If a database error occurs during the deletion.
 */
export const deleteMediaSource = async (
  mediaSourceId: string
): Promise<MediaSource> => {
  try {
    const result = await db
      .delete(mediaSources)
      .where(eq(mediaSources.id, mediaSourceId))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError({
        message: `Media source with ID ${mediaSourceId} not found`,
      });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to delete media source with ID: ${mediaSourceId}`,
      details: error,
    });
  }
};
