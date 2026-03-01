import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import { and, eq } from "drizzle-orm";
import { db, type TransactionClient } from "~/infrastructure/db/index";
import {
  type Author,
  authors,
  mediaAuthors,
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

  async findByName(name: string, tx?: Transaction): Promise<Author | null> {
    const client = (tx as unknown as TransactionClient) || db;
    const result = await client
      .select()
      .from(authors)
      .where(eq(authors.name, name))
      .limit(1);
    return result[0] || null;
  },

  async create(author: NewAuthor, tx?: Transaction): Promise<Author> {
    const client = (tx as unknown as TransactionClient) || db;
    // Check duplication
    // If accountId exists, check by accountId.
    // If not, check by name (fallback for local files/legacy data)
    const condition = author.accountId
      ? eq(authors.accountId, author.accountId)
      : eq(authors.name, author.name);

    const existing = await client
      .select()
      .from(authors)
      .where(condition)
      .limit(1);

    if (existing[0]) {
      return existing[0];
    }

    const result = await client.insert(authors).values(author).returning();
    return result[0];
  },

  async update(
    id: string,
    updates: Partial<Author>,
    tx?: Transaction
  ): Promise<Author> {
    const client = (tx as unknown as TransactionClient) || db;
    const result = await client
      .update(authors)
      .set(updates)
      .where(eq(authors.id, id))
      .returning();

    if (!result[0]) {
      throw new ResourceNotFoundError("Author", id);
    }
    return result[0];
  },

  async delete(id: string, tx?: Transaction): Promise<void> {
    const client = (tx as unknown as TransactionClient) || db;
    await client.delete(authors).where(eq(authors.id, id));
  },

  async findByMediaId(mediaId: string, tx?: Transaction): Promise<Author[]> {
    const client = (tx as unknown as TransactionClient) || db;
    const result = await client
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
  },

  async addMedia(
    mediaId: string,
    authorId: string,
    tx?: Transaction
  ): Promise<void> {
    const client = (tx as unknown as TransactionClient) || db;
    await client
      .insert(mediaAuthors)
      .values({
        mediaId,
        authorId,
      })
      .onConflictDoNothing();
  },

  async removeMedia(
    mediaId: string,
    authorId: string,
    tx?: Transaction
  ): Promise<void> {
    const client = (tx as unknown as TransactionClient) || db;
    await client
      .delete(mediaAuthors)
      .where(
        and(
          eq(mediaAuthors.mediaId, mediaId),
          eq(mediaAuthors.authorId, authorId)
        )
      );
  },
  async addMediaBulk(
    mediaId: string,
    authorIds: string[],
    tx?: Transaction
  ): Promise<void> {
    const client = (tx as unknown as TransactionClient) || db;
    if (authorIds.length === 0) {
      return;
    }

    await client
      .insert(mediaAuthors)
      .values(
        authorIds.map((authorId) => ({
          mediaId,
          authorId,
        }))
      )
      .onConflictDoNothing();
  },
};
