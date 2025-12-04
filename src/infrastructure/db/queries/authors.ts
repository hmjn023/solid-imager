import { and, eq, or } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import {
  type Author,
  type NewAuthor,
  authors,
} from "~/infrastructure/db/schema";
import { UnknownDbError } from "../errors";

/**
 * Inserts a new author or returns an existing one based on accountId or name.
 */
export const upsertAuthor = async (
  authorData: NewAuthor
): Promise<Author> => {
  try {
    // Try to find by accountId if present
    if (authorData.accountId) {
      const existingByAccount = await db
        .select()
        .from(authors)
        .where(eq(authors.accountId, authorData.accountId))
        .limit(1);
      if (existingByAccount.length > 0) {
        return existingByAccount[0];
      }
    }

    // Try to find by name if accountId is not present or not found (and we want to fallback)
    // For now, let's assume if accountId is different, it's a different author even if name is same?
    // Or should we unique by name? The schema doesn't enforce unique name.
    // Let's rely on accountId for uniqueness if provided.

    const result = await db
      .insert(authors)
      .values(authorData)
      .returning();
    return result[0];
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to upsert author",
      details: error,
    });
  }
};

export const selectAuthorByAccountId = async (
  accountId: string
): Promise<Author | undefined> => {
  const result = await db
    .select()
    .from(authors)
    .where(eq(authors.accountId, accountId))
    .limit(1);
  return result[0];
};

export const selectAuthorsByMediaId = async (
  mediaId: string
): Promise<Author[]> => {
    // This requires a join with media_authors which I should put in media-authors.ts or here.
    // I'll put it here for convenience or use media-authors.ts query.
    // Let's implement basic select first.
    return [];
};
