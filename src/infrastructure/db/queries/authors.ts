import { eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import {
  type Author,
  authors,
  type NewAuthor,
} from "~/infrastructure/db/schema";
import { UnknownDbError } from "../errors";

/**
 * Inserts a new author or returns an existing one based on accountId.
 */
export const upsertAuthor = async (authorData: NewAuthor): Promise<Author> => {
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

    // Insert new author
    const result = await db.insert(authors).values(authorData).returning();
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
