import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type { Author, NewAuthor } from "@solid-imager/core/domain/media/schemas";
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import { and, eq, inArray } from "drizzle-orm";
import { authors, mediaAuthors } from "../schema";
import type { DrizzleExecutor } from "../types";

type AuthorRepositoryOptions = {
  orderByName?: boolean;
};

function mapAuthor(row: typeof authors.$inferSelect): Author {
  return {
    id: row.id,
    name: row.name,
    accountId: row.accountId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createAuthorRepository(
  getExecutor: (tx?: unknown) => DrizzleExecutor,
  _options?: AuthorRepositoryOptions,
): IAuthorRepository {
  return {
    async findAll(): Promise<Author[]> {
      const rows = await getExecutor().select().from(authors);
      return rows.map(mapAuthor);
    },

    async findById(id: string): Promise<Author | null> {
      const rows = await getExecutor().select().from(authors).where(eq(authors.id, id)).limit(1);
      return rows[0] ? mapAuthor(rows[0]) : null;
    },

    async findByName(name: string, tx?: unknown): Promise<Author | null> {
      const rows = await getExecutor(tx)
        .select()
        .from(authors)
        .where(eq(authors.name, name))
        .limit(1);
      return rows[0] ? mapAuthor(rows[0]) : null;
    },

    async findByNames(names: string[], tx?: unknown): Promise<Author[]> {
      if (names.length === 0) return [];
      const executor = getExecutor(tx);
      const rows = await executor.select().from(authors).where(inArray(authors.name, names));
      return rows.map(mapAuthor);
    },

    async create(author: NewAuthor, tx?: unknown): Promise<Author> {
      const client = getExecutor(tx);
      const condition = author.accountId
        ? eq(authors.accountId, author.accountId)
        : eq(authors.name, author.name);

      const existing = await client.select().from(authors).where(condition).limit(1);

      if (existing[0]) {
        return mapAuthor(existing[0]);
      }

      const result = await client.insert(authors).values(author).returning();
      return mapAuthor(result[0]);
    },

    async update(id: string, updates: Partial<NewAuthor>, tx?: unknown): Promise<Author> {
      const client = getExecutor(tx);
      const result = await client
        .update(authors)
        .set({
          ...(updates.name !== undefined ? { name: updates.name } : {}),
          ...(updates.accountId !== undefined ? { accountId: updates.accountId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(authors.id, id))
        .returning();

      if (!result[0]) {
        throw new ResourceNotFoundError("Author", id);
      }
      return mapAuthor(result[0]);
    },

    async delete(id: string, tx?: unknown): Promise<void> {
      await getExecutor(tx).delete(authors).where(eq(authors.id, id));
    },

    async findByMediaId(mediaId: string, tx?: unknown): Promise<Author[]> {
      const rows = await getExecutor(tx)
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
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        accountId: r.accountId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    },

    async addMedia(mediaId: string, authorId: string, tx?: unknown): Promise<void> {
      await getExecutor(tx)
        .insert(mediaAuthors)
        .values({ mediaId, authorId })
        .onConflictDoNothing();
    },

    async removeMedia(mediaId: string, authorId: string, tx?: unknown): Promise<void> {
      await getExecutor(tx)
        .delete(mediaAuthors)
        .where(and(eq(mediaAuthors.mediaId, mediaId), eq(mediaAuthors.authorId, authorId)));
    },

    async addMediaBulk(mediaId: string, authorIds: string[], tx?: unknown): Promise<void> {
      if (authorIds.length === 0) return;
      await getExecutor(tx)
        .insert(mediaAuthors)
        .values(authorIds.map((authorId) => ({ mediaId, authorId })))
        .onConflictDoNothing();
    },

    async findOrCreateBulk(names: string[], tx?: unknown): Promise<Author[]> {
      if (names.length === 0) return [];
      const uniqueNames = [...new Set(names)].filter((n) => n.length > 0);
      const client = getExecutor(tx);

      const existing = await client
        .select()
        .from(authors)
        .where(inArray(authors.name, uniqueNames));
      const existingNames = new Set(existing.map((a) => a.name));

      const newNames = uniqueNames.filter((n) => !existingNames.has(n));
      if (newNames.length > 0) {
        await client
          .insert(authors)
          .values(newNames.map((name) => ({ name })))
          .onConflictDoNothing();
      }

      const all = await client.select().from(authors).where(inArray(authors.name, uniqueNames));
      return all.map(mapAuthor);
    },
  };
}
