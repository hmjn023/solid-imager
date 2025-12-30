import { eq } from "drizzle-orm";
import type { IAuthorRepository } from "~/domain/repositories/author.repository";
import { db } from "~/infrastructure/db/index";
import {
  type Author,
  authors,
  type NewAuthor,
} from "~/infrastructure/db/schema";

export const AuthorRepository: IAuthorRepository = {
  async findAll(): Promise<Author[]> {
    return await db.select().from(authors);
  },

  async findById(id: string): Promise<Author | null> {
    const result = await db
      .select()
      .from(authors)
      .where(eq(authors.id, id))
      .limit(1);
    return result[0] || null;
  },

  async create(author: NewAuthor): Promise<Author> {
    // Check duplication by accountId if present, similar to original upsert logic
    // but strictly speaking 'create' should perhaps just create.
    // However, existing logic had upsert behavior.
    // We will stick to the standard 'create' semantics here,
    // but if the user wants 'getOrCreate', we might need a separate method or handle it in service.
    // For now, implementing standard create.

    // UPDATE: The original query was 'upsertAuthor' which did find-or-create.
    // Detailed analysis of usage is reflected here:
    if (author.accountId) {
      const existing = await db
        .select()
        .from(authors)
        .where(eq(authors.accountId, author.accountId))
        .limit(1);
      if (existing[0]) {
        return existing[0];
      }
    }

    const result = await db.insert(authors).values(author).returning();
    return result[0];
  },

  async update(id: string, updates: Partial<Author>): Promise<Author> {
    const result = await db
      .update(authors)
      .set(updates)
      .where(eq(authors.id, id))
      .returning();

    if (!result[0]) {
      throw new Error(`Author with ID ${id} not found`);
    }
    return result[0];
  },

  async delete(id: string): Promise<void> {
    await db.delete(authors).where(eq(authors.id, id));
  },
};
