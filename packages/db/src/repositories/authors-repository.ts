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
  return {
    list: async (): Promise<AuthorListEntry[]> => {
      const rows = await getExecutor()
        .select()
        .from(authors)
        .orderBy(desc(authors.name));
      return rows.map((row) => authorSchema.parse(row));
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
      return rows.map((row) => authorSchema.parse(row));
    },
  };
}
