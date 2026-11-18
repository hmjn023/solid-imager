import { config as dotenvConfig } from "dotenv";
import type { Config } from "drizzle-kit";

// .envファイルを読み込む
dotenvConfig();

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE } = process.env;

let config: Config;

if (DB_HOST === "pglite") {
  // PGlite用の設定
  config = {
    schema: "./src/infrastructure/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    driver: "pglite",
    schemaFilter: ["public"],
    dbCredentials: {
      url: "./.data/pglite", // PGliteのデータディレクトリを指定
    },
    verbose: true,
  };
} else {
  // PostgreSQL用の設定
  if (!(DB_HOST && DB_PORT && DB_USER && DB_PASSWORD && DB_DATABASE)) {
    throw new Error("Database environment variables are not set for PostgreSQL");
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
