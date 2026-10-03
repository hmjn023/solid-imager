import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import {
	authorAccounts,
	authors,
	mediaSources,
	medias,
	mediaUrls,
	tags,
} from "~/infrastructure/db/schema";
import { AuthorService } from "~/infrastructure/services/author-service";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";

describe("AuthorRepository Deduplication", () => {
	afterEach(async () => {
		await db.delete(authors);
		await db.delete(mediaSources);
		await db.delete(tags);
	});

	it("rejects an empty author name", async () => {
		await expect(
			AuthorRepository.create({ name: "", accountId: null }),
		).rejects.toThrow("Author name cannot be empty");
	});

	it("should NOT create duplicate authors when accountId is missing but name matches", async () => {
		// 1. Create first author without accountId
		const author1 = await AuthorRepository.create({
			name: "Duplicate Tester",
			accountId: null,
		});

		// 2. Try to create second author with SAME name and NO accountId
		const author2 = await AuthorRepository.create({
			name: "Duplicate Tester",
			accountId: null, // explicit null
		});

		// 3. Verify they are the same entity (deduplicated)
		expect(author2.id).toBe(author1.id);

		// 4. Verify DB count is 1
		const count = await db
			.select()
			.from(authors)
			.where(eq(authors.name, "Duplicate Tester"));
		expect(count).toHaveLength(1);
	});

	it("deduplicates by platform account and refreshes the display name", async () => {
		const author1 = await AuthorRepository.create({
			name: "Original Name",
			accountId: "@Creator",
			platform: "twitter",
		});
		const author2 = await AuthorRepository.create({
			name: "Updated Display Name",
			accountId: "@creator",
			platform: "twitter",
		});

		expect(author2.id).toBe(author1.id);
		expect(author2.name).toBe("Updated Display Name");
		const accounts = await db
			.select()
			.from(authorAccounts)
			.where(
				and(
					eq(authorAccounts.platform, "twitter"),
					eq(authorAccounts.accountId, "creator"),
				),
			);
		expect(accounts).toHaveLength(1);
		expect(accounts[0]?.authorId).toBe(author1.id);
		const storedAuthor = await db.query.authors.findFirst({
			where: eq(authors.id, author1.id),
		});
		expect(storedAuthor?.name).toBe("Updated Display Name");
	});

	it("keeps identical account IDs on different platforms separate", async () => {
		const twitterAuthor = await AuthorRepository.create({
			name: "Twitter Creator",
			accountId: "creator",
			platform: "twitter",
		});
		const fanboxAuthor = await AuthorRepository.create({
			name: "FANBOX Creator",
			accountId: "creator",
			platform: "pixiv-fanbox",
		});

		expect(fanboxAuthor.id).not.toBe(twitterAuthor.id);
	});
	it("recognizes legacy Twitter handle spelling without choosing among ambiguous accounts", async () => {
		const [legacy] = await db
			.insert(authors)
			.values({ name: "Legacy" })
			.returning();
		await db.insert(authorAccounts).values({
			authorId: legacy.id,
			platform: "twitter",
			accountId: "@Creator",
		});
		expect(
			(
				await AuthorRepository.create({
					name: "Current",
					platform: "twitter",
					accountId: "creator",
				})
			).id,
		).toBe(legacy.id);
		const [other] = await db
			.insert(authors)
			.values({ name: "Other" })
			.returning();
		await db.insert(authorAccounts).values({
			authorId: other.id,
			platform: "twitter",
			accountId: "@CREATOR",
		});
		await expect(
			AuthorRepository.create({
				name: "Ambiguous",
				platform: "twitter",
				accountId: "creator",
			}),
		).rejects.toThrow("候補が複数");
	});

	it("keeps author and media associations when both Twitter name and handle change", async () => {
		const first = await AuthorRepository.create({
			name: "Old name",
			platform: "twitter",
			accountId: "old_handle",
			remoteId: "123",
			observedAt: new Date("2026-01-01"),
		});
		const next = await AuthorRepository.create({
			name: "New name",
			platform: "twitter",
			accountId: "new_handle",
			remoteId: "123",
			observedAt: new Date("2026-02-01"),
		});
		expect(next.id).toBe(first.id);
		expect(next.name).toBe("New name");
		expect(next.accounts).toEqual([
			expect.objectContaining({
				remoteId: "123",
				accountId: "new_handle",
				displayName: "New name",
			}),
		]);
		expect((await db.select().from(authors)).length).toBe(1);
	});
	it("does not merge a reused handle or infer a fixed ID from legacy metadata", async () => {
		const original = await AuthorRepository.create({
			name: "Creator",
			platform: "twitter",
			accountId: "shared",
			remoteId: "123",
		});
		const replacement = await AuthorRepository.create({
			name: "Creator",
			platform: "twitter",
			accountId: "shared",
			remoteId: "456",
		});
		const unresolved = await AuthorRepository.create({
			name: "Creator",
			platform: "twitter",
			accountId: "shared",
		});
		expect(new Set([original.id, replacement.id, unresolved.id]).size).toBe(3);
		expect(unresolved.accounts?.[0]?.remoteId).toBeNull();
	});
	it("does not roll back a profile with older or undated metadata and preserves an edited management name", async () => {
		const first = await AuthorRepository.create({
			name: "Current",
			platform: "twitter",
			accountId: "current",
			remoteId: "123",
			observedAt: new Date("2026-02-01"),
		});
		await AuthorRepository.create({
			name: "Old",
			platform: "twitter",
			accountId: "old",
			remoteId: "123",
			observedAt: new Date("2026-01-01"),
		});
		await AuthorRepository.create({
			name: "Undated",
			platform: "twitter",
			accountId: "undated",
			remoteId: "123",
		});
		expect(await AuthorRepository.findById(first.id)).toMatchObject({
			name: "Current",
			accountId: "current",
		});
		await AuthorRepository.update(first.id, { name: "My local label" });
		const refreshed = await AuthorRepository.create({
			name: "New profile",
			platform: "twitter",
			accountId: "new_handle",
			remoteId: "123",
			observedAt: new Date("2026-03-01"),
		});
		expect(refreshed.name).toBe("My local label");
		expect(refreshed.accounts?.[0]?.displayName).toBe("New profile");
	});
	it("returns one result per input even when several inputs resolve to the same identity", async () => {
		const result = await AuthorRepository.findOrCreateBulk([
			{ name: "First", platform: "twitter", accountId: "same" },
			{ name: "Last", platform: "twitter", accountId: "@Same" },
		]);
		expect(result).toHaveLength(2);
		expect(result[0].id).toBe(result[1].id);
		expect(result[0].name).toBe("Last");
	});
	it("restores a merged author using an existing secondary account as the anchor", async () => {
		const author = await AuthorRepository.create({
			name: "My management name",
			platform: "twitter",
			accountId: "verified",
			remoteId: "123",
		});
		const restored = await AuthorRepository.create({
			name: "My management name",
			accounts: [
				{
					platform: null,
					accountId: "old_legacy",
					remoteId: null,
					displayName: "Old display",
					profileUrl: null,
					observedAt: null,
				},
				{
					platform: "twitter",
					accountId: "verified",
					remoteId: "123",
					displayName: "External display",
					profileUrl: "https://x.com/verified",
					observedAt: new Date("2026-02-01"),
				},
			],
		});
		expect(restored.id).toBe(author.id);
		expect(restored.accounts).toHaveLength(2);
		expect(restored.name).toBe("My management name");
		const repeated = await AuthorRepository.create({
			name: restored.name,
			accounts: restored.accounts,
		});
		expect(repeated.id).toBe(author.id);
		expect(repeated.accounts).toHaveLength(2);
	});
	async function fixture() {
		const [source] = await db
			.insert(mediaSources)
			.values({
				name: "Author correction fixture",
				type: "local",
				connectionInfo: { path: "/tmp/author-correction-test" },
			})
			.returning();
		const rows = await db
			.insert(medias)
			.values(
				["one", "two"].map((name) => ({
					mediaSourceId: source.id,
					fileName: `${name}.png`,
					filePath: `${name}.png`,
					mediaType: "image" as const,
					width: 100,
					height: 100,
					fileSize: 100,
					description: null,
				})),
			)
			.returning();
		const wrong = await AuthorRepository.create({ name: "Wrong" });
		const correct = await AuthorRepository.create({ name: "Correct" });
		const coauthor = await AuthorRepository.create({ name: "Coauthor" });
		for (const row of rows)
			await AuthorRepository.addMediaBulk(row.id, [wrong.id, coauthor.id]);
		await AuthorRepository.addMedia(rows[0].id, correct.id);
		return { source, rows, wrong, correct, coauthor };
	}
	it("lists source links and corrects only selected media while preserving coauthors and existing targets", async () => {
		const { source, rows, wrong, correct, coauthor } = await fixture();
		await db
			.insert(mediaUrls)
			.values({ mediaId: rows[0].id, url: "https://x.com/actual/status/100" });
		const page = await AuthorService.listMedia({
			authorId: wrong.id,
			mediaSourceId: source.id,
			offset: 0,
			limit: 1,
		});
		expect(page.total).toBe(2);
		expect(page.items).toHaveLength(1);
		expect(page.items[0].sourceUrls).toContain(
			"https://x.com/actual/status/100",
		);
		expect(
			await AuthorService.correctMedia({
				mediaIds: [rows[0].id],
				sourceAuthorId: wrong.id,
				targetAuthorId: correct.id,
			}),
		).toBe(1);
		expect(
			(await AuthorRepository.findByMediaId(rows[0].id))
				.map((author) => author.id)
				.sort(),
		).toEqual([correct.id, coauthor.id].sort());
		expect(
			(await AuthorRepository.findByMediaId(rows[1].id)).map(
				(author) => author.id,
			),
		).toContain(wrong.id);
		expect(
			await AuthorService.correctMedia({
				mediaIds: [rows[1].id],
				sourceAuthorId: wrong.id,
				targetAuthorId: null,
			}),
		).toBe(1);
		expect(
			(await AuthorRepository.findByMediaId(rows[1].id)).map(
				(author) => author.id,
			),
		).toEqual([coauthor.id]);
	});
	it("rejects a stale selection and rolls back the whole correction", async () => {
		const { rows, wrong, correct } = await fixture();
		await AuthorRepository.removeMedia(rows[1].id, wrong.id);
		await expect(
			AuthorService.correctMedia({
				mediaIds: rows.map((row) => row.id),
				sourceAuthorId: wrong.id,
				targetAuthorId: correct.id,
			}),
		).rejects.toThrow("関連付けが変更");
		expect(
			(await AuthorRepository.findByMediaId(rows[0].id)).map(
				(author) => author.id,
			),
		).toContain(wrong.id);
	});
	it("merges all media, accounts and author tags without duplicate associations", async () => {
		const { rows, wrong, correct, coauthor } = await fixture();
		await db
			.insert(authorAccounts)
			.values({ authorId: wrong.id, platform: "twitter", accountId: "legacy" });
		await db.insert(tags).values({
			name: "author-test-tag",
			source: "manual",
			authorId: wrong.id,
		});
		expect(
			await AuthorService.merge({
				sourceAuthorId: wrong.id,
				targetAuthorId: correct.id,
			}),
		).toBe(2);
		expect(await AuthorRepository.findById(wrong.id)).toBeNull();
		expect(
			(await AuthorRepository.findById(correct.id))?.accounts?.[0]?.accountId,
		).toBe("legacy");
		for (const row of rows)
			expect(
				(await AuthorRepository.findByMediaId(row.id))
					.map((author) => author.id)
					.sort(),
			).toEqual([correct.id, coauthor.id].sort());
		expect((await db.select().from(tags))[0].authorId).toBe(correct.id);
	});
});
