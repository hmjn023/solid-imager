import { eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { type Author, authors, mediaAuthors } from "~/infrastructure/db/schema";
import { UnknownDbError } from "../errors";

export const insertMediaAuthor = async (
  mediaId: string,
  authorId: string
): Promise<void> => {
  try {
    await db
      .insert(mediaAuthors)
      .values({
        mediaId,
        authorId,
      })
      .onConflictDoNothing(); // Prevent duplicates
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to insert media author",
      details: error,
    });
  }
};

export const selectAuthorsByMediaId = async (
  mediaId: string
): Promise<Author[]> => {
  try {
    const result = await db
      .select({
        id: authors.id,
        name: authors.name,
        accountId: authors.accountId,
        createdAt: authors.createdAt,
        updatedAt: authors.updatedAt,
      })
      .from(mediaAuthors)
      .innerJoin(authors, eq(mediaAuthors.authorId, authors.id))
      .where(eq(mediaAuthors.mediaId, mediaId));
    return result;
  } catch (error) {
    throw new UnknownDbError({
      message: `Failed to select authors for mediaId: ${mediaId}`,
      details: error,
    });
  }
};
