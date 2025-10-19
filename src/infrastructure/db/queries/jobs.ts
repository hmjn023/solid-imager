import { eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { jobs } from "~/infrastructure/db/schema";
import { UnknownDbError } from "../errors";

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
