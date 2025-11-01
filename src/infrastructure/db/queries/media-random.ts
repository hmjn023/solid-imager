import { sql } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { medias } from "~/infrastructure/db/schema";
import { NotFoundError, UnknownDbError } from "../errors";

/**
 * Represents a simplified media object for random selection.
 * @property {string} id - The unique identifier of the media item.
 * @property {string} sourceId - The ID of the media source it belongs to.
 * @property {Date} createdAt - The creation timestamp of the media item.
 */
type Media = {
  id: string;
  sourceId: string;
  createdAt: Date;
};
/**
 * Selects a random media item from a specific source.
 * @param {string} sourceId - The ID of the media source to select from.
 * @returns {Promise<Media>} A promise that resolves with a random media object.
 * @throws {NotFoundError} If no media is found for the given source ID.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
export const selectRandomMedia = async (sourceId: string): Promise<Media> => {
  try {
    const result = await db
      .select()
      .from(medias)
      .where(sql`${medias.sourceId} = ${sourceId}`)
      .orderBy(sql`RANDOM()`)
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundError({
        message: "No random media found for the given sourceId",
      });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({ message: String(error) });
  }
};
