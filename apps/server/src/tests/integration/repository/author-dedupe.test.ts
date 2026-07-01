import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { db } from "~/infrastructure/db";
import { authorAccounts, authors } from "~/infrastructure/db/schema";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";

describe("AuthorRepository Deduplication", () => {
	beforeAll(async () => {
		// Ensure DB is ready
		try {
			await db.execute("DROP SCHEMA IF EXISTS drizzle CASCADE");
			await db.execute("DROP SCHEMA IF EXISTS public CASCADE");
			await db.execute("CREATE SCHEMA public");
			await migrate(db as any, { migrationsFolder: "drizzle" });
		} catch (e) {
			console.error(e);
		}
	});

	afterEach(async () => {
		await db.delete(authors);
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

	it("deduplicates an author by platform and account ID", async () => {
		const author1 = await AuthorRepository.create({
			name: "Original Name",
			accountId: "@creator",
			platform: "twitter",
		});
		const author2 = await AuthorRepository.create({
			name: "Updated Display Name",
			accountId: "@creator",
			platform: "twitter",
		});

		expect(author2.id).toBe(author1.id);
		const accounts = await db
			.select()
			.from(authorAccounts)
			.where(
				and(
					eq(authorAccounts.platform, "twitter"),
					eq(authorAccounts.accountId, "@creator"),
				),
			);
		expect(accounts).toHaveLength(1);
		expect(accounts[0]?.authorId).toBe(author1.id);
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

	it("links a platform account to a legacy author without creating a duplicate", async () => {
		const [legacyAuthor] = await db
			.insert(authors)
			.values({ name: "Legacy Creator", accountId: "legacy-creator" })
			.returning();

		const resolved = await AuthorRepository.create({
			name: "Legacy Creator",
			accountId: "legacy-creator",
			platform: "twitter",
		});

		expect(resolved.id).toBe(legacyAuthor.id);
		const matchingAuthors = await db
			.select()
			.from(authors)
			.where(eq(authors.accountId, "legacy-creator"));
		expect(matchingAuthors).toHaveLength(1);
		const accounts = await db
			.select()
			.from(authorAccounts)
			.where(eq(authorAccounts.authorId, legacyAuthor.id));
		expect(accounts).toEqual([
			expect.objectContaining({
				platform: "twitter",
				accountId: "legacy-creator",
			}),
		]);
	});
});
