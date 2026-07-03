import { randomUUID } from "node:crypto";
import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type {
	Author,
	NewAuthor,
} from "@solid-imager/core/domain/media/schemas";
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
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

function normalizeAccountId(
	platform: NonNullable<NewAuthor["platform"]>,
	accountId: string,
): string {
	if (platform !== "twitter") return accountId;
	return accountId.replace(/^@/, "").toLowerCase();
}

function normalizeAuthorInput(author: NewAuthor): NewAuthor {
	if (!(author.platform && author.accountId)) return author;
	return {
		...author,
		accountId: normalizeAccountId(author.platform, author.accountId),
	};
}

function authorIdentityKey(
	platform: NonNullable<NewAuthor["platform"]>,
	accountId: string,
): string {
	const normalizedAccountId = normalizeAccountId(platform, accountId);
	const identity =
		platform === "twitter"
			? normalizedAccountId.replace(/^@/, "")
			: normalizedAccountId;
	return `${platform}:${identity}`;
}

function normalizeLegacyAccountId(accountId: string): string {
	return accountId.replace(/^@/, "").toLowerCase();
}

function authorInputKey(author: NewAuthor): string {
	return author.platform && author.accountId
		? authorIdentityKey(author.platform, author.accountId)
		: `name:${author.name}`;
}

async function findOrCreateAuthorsBulk(
	client: DrizzleExecutor,
	inputs: NewAuthor[],
): Promise<Author[]> {
	const uniqueInputs = new Map<string, NewAuthor>();
	for (const rawInput of inputs) {
		const input = normalizeAuthorInput(rawInput);
		if (input.name.trim().length > 0) {
			uniqueInputs.set(authorInputKey(input), input);
		}
	}
	if (uniqueInputs.size === 0) return [];

	const identityConditions: SQL[] = [];
	for (const input of uniqueInputs.values()) {
		if (input.platform && input.accountId) {
			const condition = and(
				eq(authorAccounts.platform, input.platform),
				input.platform === "twitter"
					? sql`lower(regexp_replace(${authorAccounts.accountId}, '^@', '')) = ${input.accountId.replace(/^@/, "")}`
					: eq(authorAccounts.accountId, input.accountId),
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
				authorIdentityKey(row.account.platform, row.account.accountId),
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
		const allVariants = [
			...new Set(accountIds.flatMap((id) => [id, `@${id}`])),
		];
		legacyConditions.push(inArray(authors.accountId, allVariants));
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
		legacyAuthors.flatMap((author) => {
			if (!author.accountId) return [];
			const normalized = normalizeLegacyAccountId(author.accountId);
			const entries: [string, typeof authors.$inferSelect][] = [
				[normalized, author],
			];
			if (normalized !== author.accountId) {
				entries.push([author.accountId, author]);
			}
			return entries;
		}),
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
	const newlyCreatedAuthorByKey = new Map<string, string>();
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
			newlyCreatedAuthorByKey.set(key, author.id);
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
		const insertedAccounts = await client
			.insert(authorAccounts)
			.values(accountsToInsert)
			.onConflictDoNothing()
			.returning();
		const insertedKeys = new Set(
			insertedAccounts.map(
				(account) => authorIdentityKey(account.platform, account.accountId),
			),
		);
		const attemptedKeys = new Set(
			accountsToInsert.map(
				(account) => authorIdentityKey(account.platform, account.accountId),
			),
		);
		const conflicted = [...uniqueInputs.entries()].filter(
			([key, input]) =>
				input.platform &&
				input.accountId &&
				attemptedKeys.has(key) &&
				!insertedKeys.has(key),
		);
		if (conflicted.length > 0) {
			const conditions = conflicted.flatMap(([, input]) => {
				if (!(input.platform && input.accountId)) return [];
				const condition = and(
					eq(authorAccounts.platform, input.platform),
					eq(authorAccounts.accountId, input.accountId),
				);
				return condition ? [condition] : [];
			});
			const canonicalAccounts = await client
				.select({ account: authorAccounts, author: authors })
				.from(authorAccounts)
				.innerJoin(authors, eq(authorAccounts.authorId, authors.id))
				.where(or(...conditions));
			for (const row of canonicalAccounts) {
				const key = authorIdentityKey(row.account.platform, row.account.accountId);
				resolved.set(key, row.author);
			}
			const orphanIds = conflicted.flatMap(([key]) => {
				const id = newlyCreatedAuthorByKey.get(key);
				return id ? [id] : [];
			});
			if (orphanIds.length > 0) {
				await client.delete(authors).where(inArray(authors.id, orphanIds));
			}
		}
	}

	const desiredNames = new Map<string, string>();
	for (const [key, input] of uniqueInputs) {
		const author = resolved.get(key);
		if (
			author &&
			input.platform &&
			input.accountId &&
			author.name !== input.name
		) {
			desiredNames.set(author.id, input.name);
		}
	}

	const refreshedAuthors = new Map<string, typeof authors.$inferSelect>();
	if (desiredNames.size > 0) {
		const ids = [...desiredNames.keys()];
		const cases = ids.map(
			(id) => sql`WHEN ${authors.id} = ${id}::uuid THEN ${desiredNames.get(id)}`,
		);
		await client
			.update(authors)
			.set({
				name: sql`CASE ${sql.join(cases, sql` `)} END`,
				updatedAt: new Date(),
			})
			.where(inArray(authors.id, ids));

		const updatedRows = await client
			.select()
			.from(authors)
			.where(inArray(authors.id, ids));
		for (const row of updatedRows) {
			refreshedAuthors.set(row.id, row);
		}
	}

	for (const [key, author] of resolved) {
		const refreshed = refreshedAuthors.get(author.id);
		if (refreshed) resolved.set(key, refreshed);
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
			if (author.name.trim().length === 0) {
				throw new Error("Author name cannot be empty");
			}
			const result = await findOrCreateAuthorsBulk(getExecutor(tx), [author]);
			const created = result[0];
			if (!created) {
				throw new Error("Failed to create author");
			}
			return created;
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
