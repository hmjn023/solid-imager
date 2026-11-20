import { config as dotenvConfig } from "dotenv";
import type { Config } from "drizzle-kit";
import { readPostgresConfig } from "./src/infrastructure/db/postgres-config";

// .envファイルを読み込む
dotenvConfig();

const { host, port, user, password, database } = readPostgresConfig();

let config: Config;

if (host === "pglite") {
  // PGlite用の設定
  config = {
    schema: "./src/infrastructure/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql", // PGlite is compatible with PostgreSQL dialect
    dbCredentials: {
      url: "./.data/pglite", // PGliteのデータディレクトリを指定
    },
    verbose: true,
    strict: true,
  };
} else {
  // PostgreSQL用の設定
  if (!(host && user && password && database)) {
    throw new Error("Database environment variables are not set for PostgreSQL");
  }

  // Drizzle Kit enables TLS if ssl is omitted. Match pg's PGSSLMODE defaults.
  const sslMode = process.env.PGSSLMODE ?? "";
  const ssl = sslMode === "no-verify"
    ? { rejectUnauthorized: false }
    : /^(prefer|require|verify-ca|verify-full)$/.test(sslMode);
  config = {
    schema: "./src/infrastructure/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: { host, port: Number(port), user, password, database, ssl },
    verbose: true,
    strict: true,
  };
}

export default config;
