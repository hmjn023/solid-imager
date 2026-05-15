import { authorSchema } from "@solid-imager/core/domain/authors/schemas";
import { authors } from "@solid-imager/db/schema";
import { desc, like, or } from "drizzle-orm";
import { db } from "~/infrastructure/db";

export const AuthorsRepository = {
	list: async () => {
		const result = await db.select().from(authors).orderBy(desc(authors.name));
		return result.map((row) => authorSchema.parse(row));
	},
	search: async (query: string) => {
		const result = await db
			.select()
			.from(authors)
			.where(
				or(
					like(authors.name, `%${query}%`),
					like(authors.accountId, `%${query}%`),
				),
			)
			.orderBy(desc(authors.name));
		return result.map((row) => authorSchema.parse(row));
	},
};
