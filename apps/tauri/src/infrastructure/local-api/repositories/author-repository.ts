import { authorSchema } from "@solid-imager/core/domain/authors/schemas";
import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type { Author, NewAuthor } from "@solid-imager/core/domain/media/schemas";
import { authors, mediaAuthors } from "@solid-imager/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";
import type { TauriDbExecutor } from "~/infrastructure/db/client";

function getExecutor(tx?: TauriDbExecutor) {
	return tx ?? getTauriAppServices().db;
}

export const TauriAuthorRepository = {
	async findAll(): Promise<Author[]> {
		const rows = await getExecutor().select().from(authors).orderBy(asc(authors.name));
		return rows.map((row) => authorSchema.parse(row));
	},

	async findById(id: string, tx?: TauriDbExecutor): Promise<Author | null> {
		const rows = await getExecutor(tx).select().from(authors).where(eq(authors.id, id)).limit(1);
		return rows[0] ? authorSchema.parse(rows[0]) : null;
	},

	async findByName(name: string, tx?: TauriDbExecutor): Promise<Author | null> {
		const rows = await getExecutor(tx)
			.select()
			.from(authors)
			.where(eq(authors.name, name))
			.limit(1);
		return rows[0] ? authorSchema.parse(rows[0]) : null;
	},

	async create(input: NewAuthor): Promise<Author> {
		const existing = input.accountId
			? await getExecutor()
					.select()
					.from(authors)
					.where(eq(authors.accountId, input.accountId))
					.limit(1)
			: await getExecutor().select().from(authors).where(eq(authors.name, input.name)).limit(1);

		if (existing[0]) {
			return authorSchema.parse(existing[0]);
		}

		const rows = await getExecutor()
			.insert(authors)
			.values({
				name: input.name,
				accountId: input.accountId ?? null,
			})
			.returning();
		return authorSchema.parse(rows[0]);
	},

	async update(id: string, input: Partial<Pick<Author, "name" | "accountId">>): Promise<Author> {
		const rows = await getExecutor()
			.update(authors)
			.set({
				...(input.name !== undefined ? { name: input.name } : {}),
				...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
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
		await getExecutor().delete(authors).where(eq(authors.id, id));
	},

	async findByMediaId(mediaId: string, tx?: TauriDbExecutor): Promise<Author[]> {
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
			.where(eq(mediaAuthors.mediaId, mediaId))
			.orderBy(asc(authors.name));
		return rows.map((row) => authorSchema.parse(row));
	},

	async addMedia(mediaId: string, authorId: string, tx?: TauriDbExecutor): Promise<void> {
		await getExecutor(tx).insert(mediaAuthors).values({ mediaId, authorId }).onConflictDoNothing();
	},

	async addMediaBulk(mediaId: string, authorIds: string[], tx?: TauriDbExecutor): Promise<void> {
		if (authorIds.length === 0) {
			return;
		}

		await getExecutor(tx)
			.insert(mediaAuthors)
			.values(authorIds.map((authorId) => ({ mediaId, authorId })))
			.onConflictDoNothing();
	},

	async removeMedia(mediaId: string, authorId: string, tx?: TauriDbExecutor): Promise<void> {
		const rows = await getExecutor(tx)
			.delete(mediaAuthors)
			.where(and(eq(mediaAuthors.mediaId, mediaId), eq(mediaAuthors.authorId, authorId)))
			.returning();

		if (!rows[0]) {
			throw new ResourceNotFoundError(
				"MediaAuthor association",
				`mediaId: ${mediaId}, authorId: ${authorId}`,
			);
		}
	},
};
