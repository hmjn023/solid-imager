import { eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { mediaGenerationInfo } from "~/infrastructure/db/schema";
import { NotFoundError, UnknownDbError } from "../errors";

/**
 * Selects media generation information by media ID from the database.
 * @param {string} mediaId - The ID of the media item.
 * @returns {Promise<MediaGenerationInfo>} A promise that resolves with the media generation information object.
 * @throws {NotFoundError} If no media generation information is found for the given media ID.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
export const selectMediaGenerationInfoById = async (
  mediaId: string
): Promise<typeof mediaGenerationInfo.$inferSelect> => {
  try {
    const result = await db
      .select()
      .from(mediaGenerationInfo)
      .where(eq(mediaGenerationInfo.mediaId, mediaId));
    if (result.length === 0) {
      throw new NotFoundError({
        message: `Media generation info for media ID ${mediaId} not found`,
      });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to select media generation info by media ID: ${mediaId}`,
      details: error,
    });
  }
};

/**
 * Updates media generation information for a specific media item in the database.
 * @param {string} mediaId - The ID of the media item.
 * @param {object} metadata - The metadata to update.
 * @returns {Promise<MediaGenerationInfo>} A promise that resolves with the updated media generation information object.
 * @throws {NotFoundError} If no media generation information is found for the given media ID.
 * @throws {UnknownDbError} If a database error occurs during the update.
 */
export const updateMediaGenerationInfo = async (
  mediaId: string,
  metadata: object
): Promise<typeof mediaGenerationInfo.$inferSelect> => {
  try {
    const result = await db
      .update(mediaGenerationInfo)
      .set({ metadata })
      .where(eq(mediaGenerationInfo.mediaId, mediaId))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError({
        message: `Media generation info for media ID ${mediaId} not found`,
      });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to update media generation info for media ID: ${mediaId}`,
      details: error,
    });
  }
};

/**
 * Inserts or updates media generation information for a specific media item in the database.
 * If a record for the given media ID exists, it updates the prompt and workflow. Otherwise, it inserts a new record.
 * @param {string} mediaId - The ID of the media item.
 * @param {string | null} prompt - The prompt string.
 * @param {object | null} workflow - The workflow JSON object.
 * @returns {Promise<typeof mediaGenerationInfo.$inferSelect>} A promise that resolves with the upserted media generation information object.
 * @throws {UnknownDbError} If a database error occurs during the upsert operation.
 */
export const upsertMediaGenerationInfo = async (
  mediaId: string,
  prompt: string | null,
  workflow: object | null
): Promise<typeof mediaGenerationInfo.$inferSelect> => {
  try {
    const existingInfo = await db
      .select()
      .from(mediaGenerationInfo)
      .where(eq(mediaGenerationInfo.mediaId, mediaId));

    if (existingInfo.length > 0) {
      // Update existing record
      const result = await db
        .update(mediaGenerationInfo)
        .set({ prompt, workflow })
        .where(eq(mediaGenerationInfo.mediaId, mediaId))
        .returning();
      return result[0];
    }
    // Insert new record
    const result = await db
      .insert(mediaGenerationInfo)
      .values({ mediaId, prompt, workflow })
      .returning();
    return result[0];
  } catch (error) {
    throw new UnknownDbError({
      message: `Failed to upsert media generation info for media ID: ${mediaId}`,
      details: error,
    });
  }
};
