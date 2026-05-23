import { authorSchema } from "@solid-imager/core/domain/authors/schemas";
import { desc, like, or } from "drizzle-orm";
import { authors } from "../schema";
import type { DrizzleExecutor } from "../types";

export type AuthorListEntry = {
  id: string;
  name: string;
  accountId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function createAuthorsRepository(
  getExecutor: (tx?: unknown) => DrizzleExecutor,
) {
  const parseAuthor = (row: unknown): AuthorListEntry | null => {
    const result = authorSchema.safeParse(row);
    if (!result.success) {
      return null;
    }
    return result.data as AuthorListEntry;
  };

  return {
    list: async (): Promise<AuthorListEntry[]> => {
      const rows = await getExecutor()
        .select()
        .from(authors)
        .orderBy(desc(authors.name));
      return rows.map(parseAuthor).filter((a): a is AuthorListEntry => a !== null);
    },
    search: async (query: string): Promise<AuthorListEntry[]> => {
      const rows = await getExecutor()
        .select()
        .from(authors)
        .where(
          or(
            like(authors.name, `%${query}%`),
            like(authors.accountId, `%${query}%`),
          ),
        )
        .orderBy(desc(authors.name));
      return rows.map(parseAuthor).filter((a): a is AuthorListEntry => a !== null);
    },
  };
}
