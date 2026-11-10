import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { createPglite } from "~/infrastructure/db/pglite";

it("backfills tag frequencies and keeps them equal to live document counts", async () => {
	const client = createPglite();
	try {
		await client.exec(`
			CREATE TABLE media (id integer PRIMARY KEY, status text, media_type text);
			CREATE TABLE media_tags (media_id integer REFERENCES media ON DELETE CASCADE,
				tag_id uuid, tag_type text, confidence real);
			INSERT INTO media VALUES (1, 'active', 'image'), (2, 'archived', 'image'), (3, 'active', 'video');
			INSERT INTO media_tags SELECT id, '00000000-0000-4000-8000-000000000001', 'positive', NULL FROM media;
		`);
		const migration = await readFile(
			new URL(
				"../../../../drizzle/0035_related_tag_frequencies.sql",
				import.meta.url,
			),
			"utf8",
		);
		await client.exec(`BEGIN; ${migration} COMMIT;`);
		const checkCounts = async () => {
			const expected = await client.query(`
				SELECT tag_id, count(*) AS image_count FROM media_tags mt JOIN media m ON mt.media_id = m.id
				WHERE m.status = 'active' AND m.media_type = 'image' AND mt.tag_type = 'positive'
					AND coalesce(confidence, 1) > 0 GROUP BY tag_id ORDER BY tag_id
			`);
			const actual = await client.query(
				"SELECT * FROM related_tag_frequencies WHERE image_count <> 0 ORDER BY tag_id",
			);
			expect(actual.rows).toEqual(expected.rows);
		};
		await checkCounts();
		for (const change of [
			"UPDATE media SET status = 'active', media_type = 'image'",
			"UPDATE media_tags SET confidence = 0 WHERE media_id = 2",
			"UPDATE media_tags SET tag_type = 'negative' WHERE media_id = 3",
			"UPDATE media_tags SET tag_id = '00000000-0000-4000-8000-000000000002' WHERE media_id = 1",
			"UPDATE media_tags SET confidence = NULL, tag_type = 'positive'",
			"BEGIN; DELETE FROM media_tags; ROLLBACK",
			"UPDATE media SET status = 'archived' WHERE id = 1",
			"UPDATE media SET media_type = 'video' WHERE id = 2",
			"DELETE FROM media WHERE id = 3",
			"UPDATE media SET status = 'active', media_type = 'image'",
			"DELETE FROM media_tags WHERE media_id = 2",
			"TRUNCATE media_tags",
		]) {
			await client.exec(change);
			await checkCounts();
		}
	} finally {
		await client.close();
	}
});
