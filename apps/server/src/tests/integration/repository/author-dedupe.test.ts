import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { db } from "~/infrastructure/db";
import { authors } from "~/infrastructure/db/schema";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";

describe("AuthorRepository Deduplication", () => {
	beforeAll(async () => {
		// Ensure DB is ready
		try {
			await db.execute("DROP SCHEMA IF EXISTS drizzle CASCADE");
			await db.execute("DROP SCHEMA IF EXISTS public CASCADE");
			await db.execute("CREATE SCHEMA public");
			await migrate(db, { migrationsFolder: "drizzle" });
		} catch (e) {
			console.error(e);
		}
	});

	afterEach(async () => {
		await db.delete(authors);
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
});
