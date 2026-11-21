import { mkdirSync } from "node:fs";
import { config as dotenvConfig } from "dotenv";
import type { Config } from "drizzle-kit";
import { createPglite } from "./src/infrastructure/db/pglite";
import { readPostgresConfig } from "./src/infrastructure/db/postgres-config";

// .envファイルを読み込む
dotenvConfig();

const { host, port, user, password, database } = readPostgresConfig();

let config: Config;

if (host === "pglite") {
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
	if (!(host && user && password && database)) {
		throw new Error(
			"Database environment variables are not set for PostgreSQL",
		);
	}

	// Drizzle Kit enables TLS if ssl is omitted. Match pg's PGSSLMODE defaults.
	const sslMode = process.env.PGSSLMODE ?? "";
	const ssl =
		sslMode === "no-verify"
			? { rejectUnauthorized: false }
			: /^(prefer|require|verify-ca|verify-full)$/.test(sslMode);
	config = {
		schema: "./src/infrastructure/db/schema.ts",
		out: "./drizzle",
		dialect: "postgresql",
		schemaFilter: ["public"],
		dbCredentials: { host, port: Number(port), user, password, database, ssl },
		verbose: true,
	};
}

export default config;
