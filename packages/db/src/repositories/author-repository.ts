import { randomUUID } from "node:crypto";
import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type {
	Author,
	NewAuthor,
} from "@solid-imager/core/domain/media/schemas";
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import { and, eq, inArray, or, type SQL } from "drizzle-orm";
import { authorAccounts, authors, mediaAuthors } from "../schema";
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

function authorInputKey(author: NewAuthor): string {
	return author.platform && author.accountId
		? `${author.platform}:${author.accountId}`
		: `name:${author.name}`;
}

async function findOrCreateAuthorsBulk(
	client: DrizzleExecutor,
	inputs: NewAuthor[],
): Promise<Author[]> {
	const uniqueInputs = new Map<string, NewAuthor>();
	for (const input of inputs) {
		if (input.name.length > 0) {
			uniqueInputs.set(authorInputKey(input), input);
		}
	}
	if (uniqueInputs.size === 0) return [];

	const identityConditions: SQL[] = [];
	for (const input of uniqueInputs.values()) {
		if (input.platform && input.accountId) {
			const condition = and(
				eq(authorAccounts.platform, input.platform),
				eq(authorAccounts.accountId, input.accountId),
			);
			if (condition) identityConditions.push(condition);
		}
	}

	const resolved = new Map<string, typeof authors.$inferSelect>();
	if (identityConditions.length > 0) {
		const existingIdentities = await client
			.select({ account: authorAccounts, author: authors })
			.from(authorAccounts)
			.innerJoin(authors, eq(authorAccounts.authorId, authors.id))
			.where(or(...identityConditions));
		for (const row of existingIdentities) {
			resolved.set(
				`${row.account.platform}:${row.account.accountId}`,
				row.author,
			);
		}
	}

	const unresolved = [...uniqueInputs.entries()].filter(
		([key]) => !resolved.has(key),
	);
	const accountIds = [
		...new Set(
			unresolved.flatMap(([, input]) =>
				input.accountId ? [input.accountId] : [],
			),
		),
	];
	const names = [...new Set(unresolved.map(([, input]) => input.name))];
	const legacyConditions: SQL[] = [];
	if (accountIds.length > 0) {
		legacyConditions.push(inArray(authors.accountId, accountIds));
	}
	if (names.length > 0) {
		legacyConditions.push(inArray(authors.name, names));
	}

	const legacyAuthors =
		legacyConditions.length > 0
			? await client
					.select()
					.from(authors)
					.where(or(...legacyConditions))
			: [];
	const legacyByAccount = new Map(
		legacyAuthors.flatMap((author) =>
			author.accountId ? [[author.accountId, author] as const] : [],
		),
	);
	const legacyByName = new Map(
		legacyAuthors.map((author) => [author.name, author] as const),
	);
	const legacyAuthorIds = legacyAuthors.map((author) => author.id);
	const linkedLegacyAuthorIds =
		legacyAuthorIds.length > 0
			? new Set(
					(
						await client
							.select({ authorId: authorAccounts.authorId })
							.from(authorAccounts)
							.where(inArray(authorAccounts.authorId, legacyAuthorIds))
					).map((account) => account.authorId),
				)
			: new Set<string>();

	const accountsToInsert: (typeof authorAccounts.$inferInsert)[] = [];
	const authorsToInsert: (typeof authors.$inferInsert)[] = [];
	for (const [key, input] of unresolved) {
		const legacyByMatchingAccount = input.accountId
			? legacyByAccount.get(input.accountId)
			: undefined;
		const legacyByMatchingName = legacyByName.get(input.name);
		const legacy =
			legacyByMatchingAccount ??
			(legacyByMatchingName?.accountId ? undefined : legacyByMatchingName);
		const canReuseLegacy =
			legacy && (!input.platform || !linkedLegacyAuthorIds.has(legacy.id));

		const author =
			canReuseLegacy && legacy
				? legacy
				: {
						id: randomUUID(),
						name: input.name,
						accountId: input.accountId ?? null,
						createdAt: new Date(),
						updatedAt: new Date(),
					};
		if (!canReuseLegacy) {
			authorsToInsert.push({
				id: author.id,
				name: author.name,
				accountId: author.accountId,
			});
		}
		resolved.set(key, author);

		if (input.platform && input.accountId) {
			accountsToInsert.push({
				authorId: author.id,
				platform: input.platform,
				accountId: input.accountId,
			});
		}
	}

	if (authorsToInsert.length > 0) {
		await client.insert(authors).values(authorsToInsert);
	}
	if (accountsToInsert.length > 0) {
		await client
			.insert(authorAccounts)
			.values(accountsToInsert)
			.onConflictDoNothing();
	}

	return [...uniqueInputs.keys()].flatMap((key) => {
		const author = resolved.get(key);
		return author ? [mapAuthor(author)] : [];
	});
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
			const rows = await getExecutor()
				.select()
				.from(authors)
				.where(eq(authors.id, id))
				.limit(1);
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
			const rows = await executor
				.select()
				.from(authors)
				.where(inArray(authors.name, names));
			return rows.map(mapAuthor);
		},

		async create(author: NewAuthor, tx?: unknown): Promise<Author> {
			const result = await findOrCreateAuthorsBulk(getExecutor(tx), [author]);
			return result[0];
		},

		async update(
			id: string,
			updates: Partial<NewAuthor>,
			tx?: unknown,
		): Promise<Author> {
			const client = getExecutor(tx);
			const result = await client
				.update(authors)
				.set({
					...(updates.name !== undefined ? { name: updates.name } : {}),
					...(updates.accountId !== undefined
						? { accountId: updates.accountId }
						: {}),
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

		async addMediaBulk(
			mediaId: string,
			authorIds: string[],
			tx?: unknown,
		): Promise<void> {
			if (authorIds.length === 0) return;
			await getExecutor(tx)
				.insert(mediaAuthors)
				.values(authorIds.map((authorId) => ({ mediaId, authorId })))
				.onConflictDoNothing();
		},

		async findOrCreateBulk(
			inputs: NewAuthor[],
			tx?: unknown,
		): Promise<Author[]> {
			return findOrCreateAuthorsBulk(getExecutor(tx), inputs);
		},
	};
}
