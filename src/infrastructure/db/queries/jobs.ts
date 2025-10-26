import { eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { jobs } from "~/infrastructure/db/schema";
import { UnknownDbError } from "../errors";

/**
 * Selects all jobs associated with a specific media source from the database.
 * @param {string} sourceId - The ID of the media source.
 * @returns {Promise<Job[]>} A promise that resolves with an array of job objects.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
export const selectJobsBySourceId = async (
  sourceId: string
): Promise<(typeof jobs.$inferSelect)[]> => {
  try {
    return await db.select().from(jobs).where(eq(jobs.sourceId, sourceId));
  } catch (error) {
    throw new UnknownDbError({
      message: `Failed to select jobs for source ID: ${sourceId}`,
      details: error,
    });
  }
};
