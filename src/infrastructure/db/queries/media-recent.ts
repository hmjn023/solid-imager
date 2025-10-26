import { desc, eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { medias } from "~/infrastructure/db/schema";
import { UnknownDbError } from "../errors";

/**
 * Selects the most recent media items from a specific source.
 * @param {string} sourceId - The ID of the media source to select from.
 * @returns {Promise<Media[]>} A promise that resolves with an array of recent media objects.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
export const selectRecentMedia = async (sourceId: string) => {
  try {
    return await db
      .select()
      .from(medias)
      .where(eq(medias.sourceId, sourceId))
      .orderBy(desc(medias.createdAt))
      .limit(10);
  } catch (error) {
    throw new UnknownDbError({ message: String(error) });
  }
};
