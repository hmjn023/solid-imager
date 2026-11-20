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

  const url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
  config = {
    schema: "./src/infrastructure/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: { url },
    verbose: true,
    strict: true,
  };
}

export default config;
