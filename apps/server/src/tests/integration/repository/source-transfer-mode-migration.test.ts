import { readFile } from "node:fs/promises";
import {
	sourceExportJobPayloadSchema,
	sourceRestoreJobPayloadSchema,
} from "@solid-imager/core/domain/jobs/schemas";
import { expect, it } from "vitest";
import { createPglite } from "~/infrastructure/db/pglite";

type MigrationJob = {
	id: number;
	type: string;
	status: string;
	payload: Record<string, unknown> | null;
	updated_at: Date;
};

it("migrates persisted source transfer modes without changing job state or other payload fields", async () => {
	const client = createPglite();
	try {
		await client.exec(`
			CREATE TABLE jobs (id integer PRIMARY KEY, type text NOT NULL, status text NOT NULL, payload jsonb, updated_at timestamp NOT NULL);
			INSERT INTO jobs VALUES
			(1, 'source_export', 'pending', '{"mode":"json","includeImages":false}', '2026-01-01'),
			(2, 'source_export', 'in_progress', '{"mode":"zip","includeImages":true}', '2026-01-01'),
			(3, 'source_restore', 'failed', '{"mode":"json","inputPath":"/tmp/saved.ndjson"}', '2026-01-01'),
			(4, 'source_restore', 'pending', '{"mode":"zip","inputPath":"/tmp/saved.tar"}', '2026-01-01'),
			(5, 'source_export', 'completed', '{"mode":"tar","includeImages":true}', '2026-01-01'),
			(6, 'downloadImage', 'pending', '{"mode":"json","targetUrl":"https://example.com/image.png"}', '2026-01-01'),
			(7, 'source_restore', 'cancelled', '{"inputPath":"/tmp/missing-mode.tar"}', '2026-01-01'),
			(8, 'source_export', 'pending', NULL, '2026-01-01');
		`);
		const before = await client.query<MigrationJob>(
			"SELECT * FROM jobs ORDER BY id",
		);
		const migration = await readFile(
			new URL(
				"../../../../drizzle/0031_normalize_source_transfer_modes.sql",
				import.meta.url,
			),
			"utf8",
		);
		await client.exec(migration);
		const after = await client.query<MigrationJob>(
			"SELECT * FROM jobs ORDER BY id",
		);
		expect(after.rows).toEqual(
			before.rows.map((row, index) => ({
				...row,
				payload:
					index < 4
						? {
								...row.payload,
								mode: index % 2 === 0 ? "ndjson" : "tar",
							}
						: row.payload,
			})),
		);
		for (const row of after.rows.slice(0, 4)) {
			const schema =
				row.type === "source_export"
					? sourceExportJobPayloadSchema
					: sourceRestoreJobPayloadSchema;
			expect(schema.safeParse(row.payload).success).toBe(true);
		}
		await client.exec(migration);
		expect((await client.query("SELECT * FROM jobs ORDER BY id")).rows).toEqual(
			after.rows,
		);
	} finally {
		await client.close();
	}
});
