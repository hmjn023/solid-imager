import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

// .envファイルを読み込む
dotenv.config();

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE } = process.env;

if (!DB_HOST || !DB_PORT || !DB_USER || !DB_PASSWORD || !DB_DATABASE) {
  throw new Error("Database environment variables are not set");
}

const databaseUrl = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}`;

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle", // マイグレーションファイルの出力先
  dialect: "postgresql", // `driver`から`dialect`に変更
  dbCredentials: {
    url: databaseUrl, // `connectionString`から`url`に変更
  },
  verbose: true,
  strict: true,
} satisfies Config;
