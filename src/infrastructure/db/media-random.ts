import { sql } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { medias } from "~/infrastructure/db/schema";
import { NotFoundError, UnknownDbError } from "./errors";

type Media = {
  id: string;
  sourceId: string;
  createdAt: Date;
};

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
