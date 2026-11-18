import { mkdirSync } from "node:fs";
import { config as dotenvConfig } from "dotenv";
import type { Config } from "drizzle-kit";
import { createPglite } from "./src/infrastructure/db/pglite";

// .envファイルを読み込む
dotenvConfig();

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE } = process.env;

let config: Config;

if (DB_HOST === "pglite") {
	const dataDir = process.env.PGLITE_DATA_DIR || "./.data/pglite";
	// Drizzle Kit also loads this config for commands that run offline.
	const needsConnection = ["migrate", "push", "pull", "studio", "mcp"].includes(
		process.argv[2] ?? "",
	);
	if (needsConnection) {
		mkdirSync(dataDir, { recursive: true });
	}
	config = {
		schema: "./src/infrastructure/db/schema.ts",
		out: "./drizzle",
		dialect: "postgresql",
		driver: "pglite",
		schemaFilter: ["public"],
		...(needsConnection
			? { client: createPglite(dataDir) }
			: { dbCredentials: { url: dataDir } }),
		verbose: true,
	};
} else {
	// PostgreSQL用の設定
	if (!(DB_HOST && DB_PORT && DB_USER && DB_PASSWORD && DB_DATABASE)) {
		throw new Error(
			"Database environment variables are not set for PostgreSQL",
		);
	}

	const databaseUrl = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}`;
	config = {
		schema: "./src/infrastructure/db/schema.ts",
		out: "./drizzle",
		dialect: "postgresql",
		schemaFilter: ["public"],
		dbCredentials: {
			url: databaseUrl,
		},
		verbose: true,
	};
}

export default config;
