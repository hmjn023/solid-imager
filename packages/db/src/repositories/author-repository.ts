import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import type {
	Author,
	NewAuthor,
} from "@solid-imager/core/domain/media/schemas";
import { authorSchema } from "@solid-imager/core/domain/media/schemas";
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import { and, asc, eq } from "drizzle-orm";
import { authors, mediaAuthors } from "../schema";
import type { DrizzleExecutor } from "../types";

type DbAuthor = typeof authors.$inferSelect;

export type AuthorRepositoryExecutorProvider = (
	tx?: unknown,
) => DrizzleExecutor;

type CreateAuthorRepositoryOptions = {
	orderByName?: boolean;
};

function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "23505"
	);
}

function mapToAuthor(row: DbAuthor): Author {
	return authorSchema.parse({
		id: row.id,
		name: row.name,
		accountId: row.accountId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});
}

export function createAuthorRepository(
	getExecutor: AuthorRepositoryExecutorProvider,
	options: CreateAuthorRepositoryOptions = {},
): IAuthorRepository {
	return {
		async findAll(): Promise<Author[]> {
			const query = getExecutor().select().from(authors);
			const rows = await (options.orderByName
				? query.orderBy(asc(authors.name))
				: query);
			return rows.map((row) => mapToAuthor(row));
		},

		async findById(id: string): Promise<Author | null> {
			const rows = await getExecutor()
				.select()
				.from(authors)
				.where(eq(authors.id, id))
				.limit(1);
			return rows[0] ? mapToAuthor(rows[0]) : null;
		},

		async findByName(name: string, tx?: unknown): Promise<Author | null> {
			const rows = await getExecutor(tx)
				.select()
				.from(authors)
				.where(eq(authors.name, name))
				.limit(1);
			return rows[0] ? mapToAuthor(rows[0]) : null;
		},

		async findByAccountId(accountId: string): Promise<Author | null> {
			const rows = await getExecutor()
				.select()
				.from(authors)
				.where(eq(authors.accountId, accountId))
				.limit(1);
			return rows[0] ? mapToAuthor(rows[0]) : null;
		},

		async create(input: NewAuthor, tx?: unknown): Promise<Author> {
			const client = getExecutor(tx);
			const condition = input.accountId
				? eq(authors.accountId, input.accountId)
				: eq(authors.name, input.name);

			const existing = await client
				.select()
				.from(authors)
				.where(condition)
				.limit(1);

			if (existing[0]) {
				return mapToAuthor(existing[0]);
			}

			const rows = await client
				.insert(authors)
				.values({
					name: input.name,
					accountId: input.accountId ?? null,
				})
				.returning();
			return mapToAuthor(rows[0]);
		},

		async update(
			id: string,
			input: Partial<NewAuthor>,
			tx?: unknown,
		): Promise<Author> {
			try {
				const rows = await getExecutor(tx)
					.update(authors)
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

				return mapToAuthor(rows[0]);
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw new ResourceConflictError(
						`Author with name "${input.name}" already exists`,
					);
				}
				throw error;
			}
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
			return rows.map((row) => mapToAuthor(row));
		},

		async addMedia(
			mediaId: string,
			authorId: string,
			tx?: unknown,
		): Promise<void> {
			await getExecutor(tx)
				.insert(mediaAuthors)
				.values({ mediaId, authorId })
				.onConflictDoNothing();
		},

		async addMediaBulk(
			mediaId: string,
			authorIds: string[],
			tx?: unknown,
		): Promise<void> {
			if (authorIds.length === 0) {
				return;
			}

			await getExecutor(tx)
				.insert(mediaAuthors)
				.values(authorIds.map((authorId) => ({ mediaId, authorId })))
				.onConflictDoNothing();
		},

		async removeMedia(
			mediaId: string,
			authorId: string,
			tx?: unknown,
		): Promise<void> {
			await getExecutor(tx)
				.delete(mediaAuthors)
				.where(
					and(
						eq(mediaAuthors.mediaId, mediaId),
						eq(mediaAuthors.authorId, authorId),
					),
				);
		},
	};
}
