import { desc, eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { medias } from "~/infrastructure/db/schema";
import { UnknownDbError } from "./errors";

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
