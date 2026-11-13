import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createRepositories } from "@solid-imager/db";
import * as schema from "@solid-imager/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const pg = new PGlite();
const db = drizzle(pg, { schema });
const repo = createRepositories(() => db, { info() {}, error() {} }).mediaGroup;
const ids = [randomUUID(), randomUUID(), randomUUID()];
describe("persistent media groups", () => {
	beforeAll(async () => {
		await pg.exec(`CREATE FUNCTION uuidv7() RETURNS uuid LANGUAGE SQL AS 'SELECT gen_random_uuid()';
   CREATE TABLE media (id uuid PRIMARY KEY, file_name text NOT NULL, source_id uuid NOT NULL);`);
		const migration = await readFile(
			new URL("../../../drizzle/0036_gigantic_jazinda.sql", import.meta.url),
			"utf8",
		).catch(() =>
			readFile(
				new URL(
					"../../../../drizzle/0036_gigantic_jazinda.sql",
					import.meta.url,
				),
				"utf8",
			),
		);
		await pg.exec(migration);
		for (const id of ids)
			await pg.query("INSERT INTO media VALUES ($1, $2, $3)", [
				id,
				id + ".png",
				randomUUID(),
			]);
	});
	afterAll(() => pg.close());
	it("joins imports arriving separately, with stable order and idempotent replay", async () => {
		await repo.observe(ids[1], {
			platform: "pixiv",
			postId: "42",
			position: 1,
		});
		await repo.observe(ids[0], {
			platform: "pixiv",
			postId: "42",
			position: 0,
		});
		await repo.observe(ids[1], {
			platform: "pixiv",
			postId: "42",
			position: 1,
		});
		const groups = await repo.list({ mediaId: ids[0] });
		expect(groups).toHaveLength(1);
		expect(groups[0].members.map((m) => m.mediaId)).toEqual([ids[0], ids[1]]);
	});
	it("enriches unknown source ordering without changing human decisions", async () => {
		await repo.observe(ids[2], {
			platform: "twitter",
			postId: "77",
			position: null,
		});
		await repo.observe(ids[2], {
			platform: "twitter",
			postId: "77",
			position: 2,
		});
		const [group] = await repo.list({ query: "twitter:77" });
		expect(group.members[0].position).toBe(2);
		await repo.setMember({
			groupId: group.id,
			mediaId: ids[2],
			state: "tentative",
			position: null,
		});
		await repo.observe(ids[2], {
			platform: "twitter",
			postId: "77",
			position: 2,
		});
		const [updated] = await repo.list({ query: "twitter:77" });
		expect(updated.members[0]).toMatchObject({
			position: null,
			state: "tentative",
			origin: "manual",
		});
	});

	it("preserves rejection and manual ordering after reimport", async () => {
		const [group] = await repo.list({ mediaId: ids[0] });
		await repo.setMember({
			groupId: group.id,
			mediaId: ids[0],
			state: "rejected",
			position: 8,
		});
		await repo.observe(ids[0], {
			platform: "pixiv",
			postId: "42",
			position: 0,
		});
		const [updated] = await repo.list({ mediaId: ids[0] });
		expect(updated.members.find((m) => m.mediaId === ids[0])).toMatchObject({
			state: "rejected",
			position: 8,
			origin: "manual",
		});
	});
	it("supports tentative semantic groups independently of source groups", async () => {
		const group = await repo.create({
			title: "Chapter 1",
			kind: "comic",
			state: "tentative",
			mediaIds: ids,
		});
		await repo.setMember({
			groupId: group.id,
			mediaId: ids[2],
			state: "confirmed",
			position: 2,
		});
		expect(
			(await repo.list({ mediaId: ids[0] })).map((g) => g.kind).sort(),
		).toEqual(["comic", "post"]);
		await pg.query("DELETE FROM media WHERE id = $1", [ids[0]]);
		const [remaining] = await repo.list({ query: "Chapter 1" });
		expect(remaining.members).toHaveLength(2);
		expect(remaining.members[1].state).toBe("confirmed");
	});
	it("rolls back a group if any member is missing", async () => {
		await expect(
			repo.create({
				title: "Invalid",
				kind: "variant",
				state: "candidate",
				mediaIds: [ids[1], randomUUID()],
			}),
		).rejects.toThrow();
		expect(await repo.list({ query: "Invalid" })).toEqual([]);
	});
});
