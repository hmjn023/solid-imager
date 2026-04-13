import { authorSchema } from "@solid-imager/core/domain/authors/schemas";
import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type {
	Author,
	NewAuthor,
} from "@solid-imager/core/domain/media/schemas";
import { desc, eq } from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";
import { authors } from "../../../../../server/src/infrastructure/db/schema";

export const TauriAuthorRepository = {
	async findAll(): Promise<Author[]> {
		const rows = await getTauriAppServices()
			.db.select()
			.from(authors)
			.orderBy(desc(authors.name));
		return rows.map((row) => authorSchema.parse(row));
	},

	async findById(id: string): Promise<Author | null> {
		const rows = await getTauriAppServices()
			.db.select()
			.from(authors)
			.where(eq(authors.id, id))
			.limit(1);
		return rows[0] ? authorSchema.parse(rows[0]) : null;
	},

	async findByName(name: string): Promise<Author | null> {
		const rows = await getTauriAppServices()
			.db.select()
			.from(authors)
			.where(eq(authors.name, name))
			.limit(1);
		return rows[0] ? authorSchema.parse(rows[0]) : null;
	},

	async create(input: NewAuthor): Promise<Author> {
		const existing = input.accountId
			? await getTauriAppServices()
					.db.select()
					.from(authors)
					.where(eq(authors.accountId, input.accountId))
					.limit(1)
			: await getTauriAppServices()
					.db.select()
					.from(authors)
					.where(eq(authors.name, input.name))
					.limit(1);

		if (existing[0]) {
			return authorSchema.parse(existing[0]);
		}

		const rows = await getTauriAppServices()
			.db.insert(authors)
			.values({
				name: input.name,
				accountId: input.accountId ?? null,
			})
			.returning();
		return authorSchema.parse(rows[0]);
	},

	async update(
		id: string,
		input: Partial<Pick<Author, "name" | "accountId">>,
	): Promise<Author> {
		const rows = await getTauriAppServices()
			.db.update(authors)
			.set({
				...(input.name !== undefined ? { name: input.name } : {}),
				...(input.accountId !== undefined
					? { accountId: input.accountId }
					: {}),
				updatedAt: new Date(),
			})
			.where(eq(authors.id, id))
			.returning();

		if (!rows[0]) {
			throw new ResourceNotFoundError("Author", id);
		}

		return authorSchema.parse(rows[0]);
	},

	async delete(id: string): Promise<void> {
		await getTauriAppServices().db.delete(authors).where(eq(authors.id, id));
	},
};
