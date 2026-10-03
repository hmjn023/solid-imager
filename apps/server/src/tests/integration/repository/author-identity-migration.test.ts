import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createPglite } from "~/infrastructure/db/pglite";

describe("author account migration", () => {
	it("preserves unscoped legacy values, duplicates and known identities without guessing fixed IDs", async () => {
		const client = createPglite();
		try {
			await client.exec(`
    CREATE TYPE author_platform AS ENUM ('twitter', 'pixiv-fanbox', 'danbooru');
    CREATE TABLE authors (id uuid PRIMARY KEY DEFAULT uuidv7(), name text NOT NULL, account_id text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now());
    CREATE INDEX idx_authors_account_id ON authors(account_id);
    CREATE TABLE author_accounts (id uuid PRIMARY KEY DEFAULT uuidv7(), author_id uuid NOT NULL REFERENCES authors(id), platform author_platform NOT NULL, account_id text NOT NULL, profile_url text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now());
    CREATE UNIQUE INDEX idx_author_accounts_platform_account_unique ON author_accounts(platform, account_id);
    INSERT INTO authors(id, name, account_id) VALUES
     ('11111111-1111-4111-8111-111111111111', 'Known', 'creator'),
     ('22222222-2222-4222-8222-222222222222', 'Legacy one', 'shared'),
     ('33333333-3333-4333-8333-333333333333', 'Legacy two', 'shared');
    INSERT INTO author_accounts(author_id, platform, account_id) VALUES ('11111111-1111-4111-8111-111111111111', 'twitter', 'creator');
   `);
			const migration = await readFile(
				new URL(
					"../../../../drizzle/0030_small_impossible_man.sql",
					import.meta.url,
				),
				"utf8",
			);
			await client.transaction(async (tx) => {
				for (const statement of migration.split("--> statement-breakpoint"))
					if (statement.trim()) await tx.exec(statement);
			});
			const accounts = await client.query<{
				platform: string | null;
				account_id: string;
				remote_id: string | null;
				display_name: string;
			}>(
				"SELECT platform, account_id, remote_id, display_name FROM author_accounts ORDER BY display_name",
			);
			expect(accounts.rows).toEqual([
				{
					platform: "twitter",
					account_id: "creator",
					remote_id: null,
					display_name: "Known",
				},
				{
					platform: null,
					account_id: "shared",
					remote_id: null,
					display_name: "Legacy one",
				},
				{
					platform: null,
					account_id: "shared",
					remote_id: null,
					display_name: "Legacy two",
				},
			]);
			expect((await client.query("SELECT * FROM authors")).rows).toHaveLength(
				3,
			);
			expect(
				(
					await client.query(
						"SELECT column_name FROM information_schema.columns WHERE table_name = 'authors' AND column_name = 'account_id'",
					)
				).rows,
			).toHaveLength(0);
		} finally {
			await client.close();
		}
	});
});
