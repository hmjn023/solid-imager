import type { MigrationMeta } from "drizzle-orm/migrator";
import migrationJournal from "../../../../server/drizzle/meta/_journal.json";

type MigrationJournal = {
	entries: Array<{
		tag: string;
		when: number;
		breakpoints: boolean;
	}>;
};

const migrationModules = import.meta.glob<string>("../../../../server/drizzle/*.sql", {
	query: "?raw",
	import: "default",
	eager: true,
});

function getMigrationSqlByTag(tag: string): string | undefined {
	const suffix = `/${tag}.sql`;
	for (const [path, sql] of Object.entries(migrationModules)) {
		if (path.endsWith(suffix)) {
			return sql;
		}
	}
	return undefined;
}

async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function loadServerMigrations(): Promise<MigrationMeta[]> {
	const { entries } = migrationJournal as MigrationJournal;

	return await Promise.all(
		entries.map(async (entry) => {
			const sql = getMigrationSqlByTag(entry.tag);
			if (!sql) {
				throw new Error(`Missing bundled migration SQL for ${entry.tag}.`);
			}

			return {
				sql: sql.split("--> statement-breakpoint"),
				folderMillis: entry.when,
				hash: await sha256Hex(sql),
				bps: entry.breakpoints,
			};
		}),
	);
}
