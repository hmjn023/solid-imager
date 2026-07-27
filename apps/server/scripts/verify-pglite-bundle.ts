import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

type PgliteLike = {
	exec(sql: string): Promise<unknown>;
	query<T>(sql: string): Promise<{ rows: T[] }>;
	close(): Promise<void>;
};

type PgliteConstructor = new (
	dataDir: string,
	options: { extensions: { vector: unknown } },
) => PgliteLike;

type MigrationJournal = {
	entries: Array<{ tag: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function findChunk(files: string[], packageName: string): string {
	const match = files.find(
		(file) =>
			file.endsWith(".mjs") &&
			file.includes(packageName) &&
			(packageName.includes("pgvector") || !file.includes("pgvector")),
	);
	if (!match) {
		throw new Error(`Bundled module chunk not found for ${packageName}`);
	}
	return match;
}

async function loadBundledRuntime(libsDir: string): Promise<{
	PGlite: PgliteConstructor;
	vector: unknown;
}> {
	const files = await readdir(libsDir);
	const pglitePath = path.join(libsDir, findChunk(files, "electric-sql__pglite"));
	const vectorPath = path.join(
		libsDir,
		findChunk(files, "electric-sql__pglite-pgvector"),
	);
	const pgliteModule: unknown = await import(pathToFileURL(pglitePath).href);
	const vectorModule: unknown = await import(pathToFileURL(vectorPath).href);
	if (
		!isRecord(pgliteModule) ||
		typeof pgliteModule.PGlite !== "function" ||
		!isRecord(vectorModule) ||
		!("vector" in vectorModule)
	) {
		throw new Error("Bundled PGlite modules do not expose the expected API");
	}
	return {
		PGlite: pgliteModule.PGlite as PgliteConstructor,
		vector: vectorModule.vector,
	};
}

async function main(): Promise<void> {
	const outputServer = path.resolve(process.cwd(), ".output/server");
	const sandbox = await mkdtemp(
		path.join(os.tmpdir(), "solid-imager-pglite-bundle-"),
	);
	try {
		const isolatedServer = path.join(sandbox, "server");
		await cp(outputServer, isolatedServer, { recursive: true });
		const libsDir = path.join(isolatedServer, "_libs");
		const { PGlite, vector } = await loadBundledRuntime(libsDir);
		const dataDir = path.join(sandbox, "database");
		let database = new PGlite(dataDir, { extensions: { vector } });
		const migrationsDir = path.join(isolatedServer, "drizzle");
		const journal: MigrationJournal = JSON.parse(
			await readFile(path.join(migrationsDir, "meta", "_journal.json"), "utf8"),
		);
		for (const entry of journal.entries) {
			const migrationSql = await readFile(
				path.join(migrationsDir, `${entry.tag}.sql`),
				"utf8",
			);
			if (!migrationSql.trim()) {
				throw new Error(`Bundled migration is empty: ${entry.tag}`);
			}
			for (const statement of migrationSql.split("--> statement-breakpoint")) {
				if (statement.trim()) await database.exec(statement);
			}
		}
		await database.exec(`
			CREATE TABLE bundle_probe (id integer PRIMARY KEY, embedding vector(3));
			INSERT INTO bundle_probe VALUES (1, '[1,0,0]');
		`);
		await database.close();

		database = new PGlite(dataDir, { extensions: { vector } });
		const result = await database.query<{
			count: number;
			migrationCount: number;
			vectorInstalled: boolean;
		}>(`
			SELECT
				(SELECT count(*)::integer FROM bundle_probe WHERE embedding <=> '[1,0,0]'::vector = 0) AS count,
				${journal.entries.length}::integer AS "migrationCount",
				EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS "vectorInstalled"
		`);
		await database.close();
		const row = result.rows[0];
		if (
			row?.count !== 1 ||
			row.migrationCount !== journal.entries.length ||
			!row.vectorInstalled
		) {
			throw new Error(
				"Bundled PGlite migrations/vector database did not survive close/reopen",
			);
		}
		process.stdout.write(
			`${JSON.stringify({ ok: true, runtime: "isolated-output", vector: true, migrations: journal.entries.length })}\n`,
		);
	} finally {
		await rm(sandbox, { recursive: true, force: true });
	}
}

await main();
