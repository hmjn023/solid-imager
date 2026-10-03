import type {
	Author,
	AuthorAccount,
	NewAuthor,
	AuthorMediaPage,
	CorrectMediaAuthorsInput,
	MergeAuthorsInput,
} from "@solid-imager/core/domain/authors/schemas";
import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import {
	authorAccounts,
	authors,
	mediaAuthors,
	medias,
	mediaUrls,
	tags,
} from "../schema";
import { createTransactionManager } from "../transaction-manager";
import type { DrizzleExecutor } from "../types";

function mapAccount(row: typeof authorAccounts.$inferSelect): AuthorAccount {
	return {
		id: row.id,
		authorId: row.authorId,
		platform: row.platform,
		accountId: row.accountId,
		remoteId: row.remoteId,
		displayName: row.displayName,
		profileUrl: row.profileUrl,
		observedAt: row.observedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export function mapAuthor(
	row: typeof authors.$inferSelect,
	accountRows: (typeof authorAccounts.$inferSelect)[],
): Author {
	const accounts = [...accountRows]
		.sort(
			(left, right) =>
				left.createdAt.getTime() - right.createdAt.getTime() ||
				left.id.localeCompare(right.id),
		)
		.map(mapAccount);
	return {
		id: row.id,
		name: row.name,
		accountId: accounts[0]?.accountId ?? null,
		accounts,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export async function mapAuthors(
	client: DrizzleExecutor,
	rows: (typeof authors.$inferSelect)[],
): Promise<Author[]> {
	if (rows.length === 0) return [];
	const accounts = await client
		.select()
		.from(authorAccounts)
		.where(
			inArray(
				authorAccounts.authorId,
				rows.map((row) => row.id),
			),
		)
		.orderBy(asc(authorAccounts.createdAt), asc(authorAccounts.id));
	const byAuthor = new Map<string, (typeof authorAccounts.$inferSelect)[]>();
	for (const account of accounts) {
		const list = byAuthor.get(account.authorId) ?? [];
		list.push(account);
		byAuthor.set(account.authorId, list);
	}
	return rows.map((row) => mapAuthor(row, byAuthor.get(row.id) ?? []));
}

function normalize(input: NewAuthor): NewAuthor {
	const accountId = input.accountId?.trim();
	return {
		...input,
		name: input.name.trim(),
		accountId:
			accountId && input.platform === "twitter"
				? accountId.replace(/^@/, "").toLowerCase()
				: accountId || null,
	};
}

function identityKey(input: NewAuthor): string {
	if (input.remoteId && input.platform)
		return `${input.platform}:id:${input.remoteId}`;
	if (input.accountId)
		return `${input.platform ?? "unknown"}:handle:${input.accountId}`;
	return `name:${input.name}`;
}

function accountIdentity(input: NewAuthor) {
	const platform = input.platform
		? eq(authorAccounts.platform, input.platform)
		: isNull(authorAccounts.platform);
	return input.remoteId
		? and(platform, eq(authorAccounts.remoteId, input.remoteId))
		: and(
				platform,
				isNull(authorAccounts.remoteId),
				input.platform === "twitter"
					? sql`lower(regexp_replace(${authorAccounts.accountId}, '^@', '')) = ${input.accountId}`
					: eq(authorAccounts.accountId, input.accountId ?? ""),
			);
}

async function findAccount(client: DrizzleExecutor, input: NewAuthor) {
	const matches = await client
		.select()
		.from(authorAccounts)
		.where(accountIdentity(input))
		.limit(2);
	if (matches.length > 1)
		throw new ResourceConflictError(
			"外部アカウントの候補が複数あります。作者管理で確認して統合してください。",
		);
	return matches[0];
}

function isFreshProfile(
	account: typeof authorAccounts.$inferSelect,
	observedAt: Date | undefined,
): boolean {
	return (
		!account.observedAt ||
		Boolean(observedAt && observedAt >= account.observedAt)
	);
}

async function refreshAccount(
	client: DrizzleExecutor,
	account: typeof authorAccounts.$inferSelect,
	input: NewAuthor,
	displayName: string,
): Promise<void> {
	if (!isFreshProfile(account, input.observedAt)) return;
	await client
		.update(authorAccounts)
		.set({
			accountId: input.accountId ?? account.accountId,
			displayName,
			profileUrl: input.profileUrl ?? account.profileUrl,
			observedAt: input.observedAt ?? account.observedAt,
			updatedAt: new Date(),
		})
		.where(eq(authorAccounts.id, account.id));
}

async function resolveAuthors(
	client: DrizzleExecutor,
	rawInputs: NewAuthor[],
): Promise<Author[]> {
	const inputs = rawInputs
		.map((raw) => {
			const primary = raw.accounts?.[0];
			return normalize(
				primary
					? {
							...raw,
							accountId: primary.accountId,
							platform: primary.platform ?? undefined,
							remoteId: primary.remoteId,
							observedAt: primary.observedAt ?? undefined,
							profileUrl: primary.profileUrl,
						}
					: raw,
			);
		})
		.filter((input) => input.name.length > 0);
	// Sorted transaction locks serialize find/create and avoid duplicate name-only authors.
	const identityKeys = inputs.flatMap((input) => [
		identityKey(input),
		...(input.accounts?.slice(1) ?? []).map((account) =>
			identityKey(
				normalize({
					...account,
					platform: account.platform ?? undefined,
					observedAt: account.observedAt ?? undefined,
					name: input.name,
				}),
			),
		),
	]);
	for (const key of [...new Set(identityKeys)].sort()) {
		await client.execute(
			sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
		);
	}
	const resolvedRows: (typeof authors.$inferSelect)[] = [];
	for (const input of inputs) {
		let account: typeof authorAccounts.$inferSelect | undefined;
		if (input.accountId) {
			// A mutable handle must never be used to merge into a verified identity.
			account = await findAccount(client, input);
		}
		// Any account in a backup may be the existing anchor, regardless of array order.
		const existingAuthorIds = new Set(account ? [account.authorId] : []);
		for (const extra of input.accounts?.slice(1) ?? []) {
			const existing = await findAccount(
				client,
				normalize({
					...extra,
					platform: extra.platform ?? undefined,
					observedAt: extra.observedAt ?? undefined,
					name: input.name,
				}),
			);
			if (existing) existingAuthorIds.add(existing.authorId);
		}
		if (existingAuthorIds.size > 1)
			throw new ResourceConflictError(
				"外部アカウントが別の作者に紐づいています。作者管理で確認して統合してください。",
			);
		const existingAuthorId = existingAuthorIds.values().next().value;
		let author: typeof authors.$inferSelect | undefined;
		if (existingAuthorId) {
			[author] = await client
				.select()
				.from(authors)
				.where(eq(authors.id, existingAuthorId))
				.limit(1);
		} else if (!input.accountId) {
			// Names only resolve unlinked, name-only authors; identical names are not identity evidence.
			[author] = await client
				.select()
				.from(authors)
				.where(
					and(
						eq(authors.name, input.name),
						sql`NOT EXISTS (SELECT 1 FROM ${authorAccounts} WHERE ${authorAccounts.authorId} = ${authors.id})`,
					),
				)
				.limit(1);
		}
		if (!author) {
			[author] = await client
				.insert(authors)
				.values({ name: input.name })
				.returning();
		}
		if (!author) throw new Error("Failed to create author");
		const profileName = input.accounts?.[0]?.displayName ?? input.name;
		if (account && isFreshProfile(account, input.observedAt)) {
			// Keep a deliberately edited local author name; update platform profile independently.
			if (
				!input.accounts &&
				author.name === (account.displayName ?? author.name) &&
				input.name !== author.name
			) {
				const [updated] = await client
					.update(authors)
					.set({ name: input.name, updatedAt: new Date() })
					.where(eq(authors.id, author.id))
					.returning();
				if (updated) author = updated;
			}
			await refreshAccount(client, account, input, profileName);
		} else if (!account && input.accountId) {
			await client.insert(authorAccounts).values({
				authorId: author.id,
				platform: input.platform ?? null,
				accountId: input.accountId,
				remoteId: input.remoteId ?? null,
				displayName: profileName,
				profileUrl: input.profileUrl ?? null,
				observedAt: input.observedAt ?? null,
			});
		}
		// A restore can explicitly carry several accounts belonging to this author.
		for (const extra of input.accounts?.slice(1) ?? []) {
			const normalized = normalize({
				...extra,
				platform: extra.platform ?? undefined,
				observedAt: extra.observedAt ?? undefined,
				name: input.name,
			});
			const existing = await findAccount(client, normalized);
			if (existing && existing.authorId !== author.id)
				throw new ResourceConflictError(
					"外部アカウントが別の作者に紐づいています。作者管理で確認して統合してください。",
				);
			if (existing) {
				await refreshAccount(
					client,
					existing,
					normalized,
					extra.displayName ?? input.name,
				);
			} else {
				await client.insert(authorAccounts).values({
					...extra,
					accountId: normalized.accountId ?? extra.accountId,
					authorId: author.id,
				});
			}
		}
		resolvedRows.push(author);
	}
	// Reload once so repeated inputs in a bulk request expose the final profile state.
	const rows = resolvedRows.length
		? await client
				.select()
				.from(authors)
				.where(
					inArray(
						authors.id,
						resolvedRows.map((row) => row.id),
					),
				)
		: [];
	const byId = new Map(
		(await mapAuthors(client, rows)).map((author) => [author.id, author]),
	);
	return resolvedRows.flatMap((row) => {
		const author = byId.get(row.id);
		return author ? [author] : [];
	});
}

export function createAuthorRepository(
	getExecutor: (tx?: unknown) => DrizzleExecutor,
): IAuthorRepository {
	const transactions = createTransactionManager(() => getExecutor());
	const resolve = (inputs: NewAuthor[], tx?: unknown) =>
		tx
			? resolveAuthors(getExecutor(tx), inputs)
			: transactions.transaction((transaction) =>
					resolveAuthors(getExecutor(transaction), inputs),
				);
	const findById = async (id: string, tx?: unknown): Promise<Author | null> => {
		const client = getExecutor(tx);
		const rows = await client
			.select()
			.from(authors)
			.where(eq(authors.id, id))
			.limit(1);
		return (await mapAuthors(client, rows))[0] ?? null;
	};
	const findByMediaId = async (
		mediaId: string,
		tx?: unknown,
	): Promise<Author[]> => {
		const client = getExecutor(tx);
		const rows = await client
			.select({ author: authors })
			.from(mediaAuthors)
			.innerJoin(authors, eq(mediaAuthors.authorId, authors.id))
			.where(eq(mediaAuthors.mediaId, mediaId));
		return mapAuthors(
			client,
			rows.map((row) => row.author),
		);
	};
	return {
		async confirmAccount(input, tx) {
			const client = getExecutor(tx);
			// Lock both the old identity and the new fixed ID in the import lock order.
			// Otherwise an in-flight handle-only import could overwrite a promoted account.
			const [previous] = input.accountId
				? await client
						.select()
						.from(authorAccounts)
						.where(eq(authorAccounts.id, input.accountId))
				: [];
			const keys = [`twitter:id:${input.profile.remoteId}`];
			if (previous)
				keys.push(
					identityKey(
						normalize({
							name: "",
							platform: previous.platform ?? undefined,
							accountId: previous.accountId,
							remoteId: previous.remoteId,
						}),
					),
				);
			for (const key of [...new Set(keys)].sort())
				await client.execute(
					sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
				);
			const [author] = await client
				.select()
				.from(authors)
				.where(eq(authors.id, input.authorId))
				.for("update");
			const [account] = input.accountId
				? await client
						.select()
						.from(authorAccounts)
						.where(
							and(
								eq(authorAccounts.id, input.accountId),
								eq(authorAccounts.authorId, input.authorId),
							),
						)
						.for("update")
				: [];
			if (!author || (input.accountId && !account))
				throw new ResourceNotFoundError(
					"Author account",
					input.accountId ?? input.authorId,
				);
			if (!input.accountId) {
				const [existing] = await client
					.select({ id: authorAccounts.id })
					.from(authorAccounts)
					.where(eq(authorAccounts.authorId, input.authorId))
					.limit(1);
				if (existing)
					throw new ResourceConflictError(
						"アカウント情報が変更されています。再取得して確認してください。",
					);
			}
			if (
				(account?.updatedAt ?? author.updatedAt).getTime() !==
				input.expectedUpdatedAt.getTime()
			)
				throw new ResourceConflictError(
					"アカウント情報が変更されています。再取得して確認してください。",
				);
			if (
				(account?.platform && account.platform !== "twitter") ||
				(account?.remoteId && account.remoteId !== input.profile.remoteId)
			)
				throw new ResourceConflictError(
					"登録済みの固定IDと異なります。作者の付け替え・統合で修正してください。",
				);
			const [owner] = await client
				.select()
				.from(authorAccounts)
				.where(
					and(
						eq(authorAccounts.platform, "twitter"),
						eq(authorAccounts.remoteId, input.profile.remoteId),
					),
				);
			if (owner && owner.id !== account?.id)
				throw new ResourceConflictError(
					"この固定IDは別のアカウントに登録されています。同一人物と確認して作者を統合してください。",
				);
			const now = new Date();
			const values = {
				platform: "twitter" as const,
				accountId: input.profile.username.toLowerCase(),
				remoteId: input.profile.remoteId,
				displayName: input.profile.displayName,
				profileUrl: `https://x.com/${input.profile.username}`,
				observedAt: input.observedAt,
				updatedAt: now,
			};
			if (account)
				await client
					.update(authorAccounts)
					.set(values)
					.where(eq(authorAccounts.id, account.id));
			else
				await client
					.insert(authorAccounts)
					.values({ ...values, authorId: author.id });
			// Keep deliberately edited management names; otherwise follow the profile.
			await client
				.update(authors)
				.set({
					name:
						account?.displayName && author.name === account.displayName
							? input.profile.displayName
							: author.name,
					updatedAt: now,
				})
				.where(eq(authors.id, author.id));
			const result = await findById(author.id, tx);
			if (!result) throw new ResourceNotFoundError("Author", author.id);
			return result;
		},
		async findAll() {
			const client = getExecutor();
			return mapAuthors(
				client,
				await client
					.select()
					.from(authors)
					.orderBy(asc(authors.name), asc(authors.id)),
			);
		},
		findById,
		async findByName(name, tx) {
			const client = getExecutor(tx);
			const rows = await client
				.select()
				.from(authors)
				.where(eq(authors.name, name))
				.limit(1);
			return (await mapAuthors(client, rows))[0] ?? null;
		},
		async findByNames(names, tx) {
			if (!names.length) return [];
			const client = getExecutor(tx);
			return mapAuthors(
				client,
				await client.select().from(authors).where(inArray(authors.name, names)),
			);
		},
		async create(input, tx) {
			if (!input.name.trim()) throw new Error("Author name cannot be empty");
			const [author] = await resolve([input], tx);
			if (!author) throw new Error("Failed to create author");
			return author;
		},
		async update(id, updates, tx) {
			// Profile edits belong to the account, not the local author record.
			if (
				updates.accountId !== undefined ||
				updates.remoteId !== undefined ||
				updates.platform !== undefined ||
				updates.accounts !== undefined ||
				updates.profileUrl !== undefined ||
				updates.observedAt !== undefined
			) {
				throw new Error(
					"Edit external identities through verified imports or explicit author merging",
				);
			}
			const client = getExecutor(tx);
			const [row] = await client
				.update(authors)
				.set({
					...(updates.name !== undefined ? { name: updates.name } : {}),
					updatedAt: new Date(),
				})
				.where(eq(authors.id, id))
				.returning();
			if (!row) throw new ResourceNotFoundError("Author", id);
			const [author] = await mapAuthors(client, [row]);
			if (!author) throw new ResourceNotFoundError("Author", id);
			return author;
		},
		async delete(id, tx) {
			await getExecutor(tx).delete(authors).where(eq(authors.id, id));
		},
		findByMediaId,
		async addMedia(mediaId, authorId, tx) {
			await getExecutor(tx)
				.insert(mediaAuthors)
				.values({ mediaId, authorId })
				.onConflictDoNothing();
		},
		async removeMedia(mediaId, authorId, tx) {
			await getExecutor(tx)
				.delete(mediaAuthors)
				.where(
					and(
						eq(mediaAuthors.mediaId, mediaId),
						eq(mediaAuthors.authorId, authorId),
					),
				);
		},
		async addMediaBulk(mediaId, authorIds, tx) {
			if (authorIds.length)
				await getExecutor(tx)
					.insert(mediaAuthors)
					.values(authorIds.map((authorId) => ({ mediaId, authorId })))
					.onConflictDoNothing();
		},
		findOrCreateBulk: resolve,
		async listMedia(input): Promise<AuthorMediaPage> {
			const client = getExecutor();
			const filter = and(
				eq(mediaAuthors.authorId, input.authorId),
				input.mediaSourceId
					? eq(medias.mediaSourceId, input.mediaSourceId)
					: undefined,
			);
			const [total] = await client
				.select({ value: count() })
				.from(mediaAuthors)
				.innerJoin(medias, eq(medias.id, mediaAuthors.mediaId))
				.where(filter);
			const rows = await client
				.select({ media: medias })
				.from(mediaAuthors)
				.innerJoin(medias, eq(medias.id, mediaAuthors.mediaId))
				.where(filter)
				.orderBy(asc(medias.id))
				.limit(input.limit)
				.offset(input.offset);
			const ids = rows.map((row) => row.media.id);
			if (!ids.length) return { items: [], total: total?.value ?? 0 };
			const links = await client
				.select()
				.from(mediaAuthors)
				.where(inArray(mediaAuthors.mediaId, ids));
			const authorIds = [...new Set(links.map((link) => link.authorId))];
			const authorRows = await client
				.select()
				.from(authors)
				.where(inArray(authors.id, authorIds));
			const byId = new Map(
				(await mapAuthors(client, authorRows)).map((author) => [
					author.id,
					author,
				]),
			);
			const urls = await client
				.select()
				.from(mediaUrls)
				.where(inArray(mediaUrls.mediaId, ids));
			return {
				total: total?.value ?? 0,
				items: rows.map(({ media }) => ({
					id: media.id,
					mediaSourceId: media.mediaSourceId,
					fileName: media.fileName,
					modifiedAt: media.modifiedAt,
					authors: links
						.filter((link) => link.mediaId === media.id)
						.flatMap((link) => {
							const author = byId.get(link.authorId);
							return author ? [author] : [];
						}),
					sourceUrls: urls
						.filter((url) => url.mediaId === media.id)
						.map((url) => url.url),
				})),
			};
		},
		async correctMedia(input: CorrectMediaAuthorsInput, tx) {
			const client = getExecutor(tx);
			const ids = [...new Set(input.mediaIds)];
			// Use the same author-first lock order as merging, then lock media in UUID order.
			await client
				.select({ id: authors.id })
				.from(authors)
				.where(
					inArray(
						authors.id,
						input.targetAuthorId
							? [input.sourceAuthorId, input.targetAuthorId]
							: [input.sourceAuthorId],
					),
				)
				.orderBy(asc(authors.id))
				.for("update");
			// Lock media records so concurrent corrections cannot silently change this selection.
			await client
				.select({ id: medias.id })
				.from(medias)
				.where(inArray(medias.id, ids))
				.orderBy(asc(medias.id))
				.for("update");
			const source = await findById(input.sourceAuthorId, tx);
			if (!source)
				throw new ResourceNotFoundError("Author", input.sourceAuthorId);
			if (input.targetAuthorId && !(await findById(input.targetAuthorId, tx))) {
				throw new ResourceNotFoundError("Author", input.targetAuthorId);
			}
			const links = await client
				.select()
				.from(mediaAuthors)
				.where(
					and(
						inArray(mediaAuthors.mediaId, ids),
						eq(mediaAuthors.authorId, input.sourceAuthorId),
					),
				);
			if (links.length !== ids.length)
				throw new ResourceConflictError(
					"作者の関連付けが変更されています。一覧を再取得してください。",
				);
			if (input.targetAuthorId)
				await client
					.insert(mediaAuthors)
					.values(
						ids.map((mediaId) => ({
							mediaId,
							authorId: input.targetAuthorId ?? "",
						})),
					)
					.onConflictDoNothing();
			await client
				.delete(mediaAuthors)
				.where(
					and(
						inArray(mediaAuthors.mediaId, ids),
						eq(mediaAuthors.authorId, input.sourceAuthorId),
					),
				);
			return ids.length;
		},
		async merge(input: MergeAuthorsInput, tx) {
			const client = getExecutor(tx);
			const locked = await client
				.select()
				.from(authors)
				.where(
					inArray(authors.id, [input.sourceAuthorId, input.targetAuthorId]),
				)
				.orderBy(asc(authors.id))
				.for("update");
			if (locked.length !== 2) throw new ResourceNotFoundError("Author");
			const [total] = await client
				.select({ value: count() })
				.from(mediaAuthors)
				.where(eq(mediaAuthors.authorId, input.sourceAuthorId));
			// Copy within the database so the parameter count is independent of library size.
			await client
				.insert(mediaAuthors)
				.select(
					client
						.select({
							mediaId: mediaAuthors.mediaId,
							authorId: sql<string>`${input.targetAuthorId}::uuid`.as(
								"author_id",
							),
						})
						.from(mediaAuthors)
						.where(eq(mediaAuthors.authorId, input.sourceAuthorId)),
				)
				.onConflictDoNothing();
			await client
				.update(authorAccounts)
				.set({ authorId: input.targetAuthorId, updatedAt: new Date() })
				.where(eq(authorAccounts.authorId, input.sourceAuthorId));
			await client
				.update(tags)
				.set({ authorId: input.targetAuthorId })
				.where(eq(tags.authorId, input.sourceAuthorId));
			await client.delete(authors).where(eq(authors.id, input.sourceAuthorId));
			return total?.value ?? 0;
		},
	};
}
