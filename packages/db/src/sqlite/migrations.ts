/// <reference types="vite/client" />
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { SqliteDb } from "./client";
import type { MockSqliteDb } from "./client.mock";

// マイグレーション履歴管理用の Drizzle スキーマ定義
const migrationsTable = sqliteTable("__drizzle_migrations", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	hash: text("hash").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// Vite のインポート機能を使用して、マイグレーション SQL ファイル群を文字列として事前バンドル
// 例: /migrations/0000_init.sql, /migrations/0001_add_index.sql
const migrationsGlob = import.meta.glob("./migrations/*.sql", {
	query: "?raw",
	eager: true,
}) as Record<string, { default: string }>;

/**
 * 読み込まれた SQL 文字列から、安全に実行可能な単一ステートメント群に分割します。
 * (注: コメント行の除去や、不要な空行のフィルタリングを行います)
 */
function parseSqlStatements(sqlText: string): string[] {
	return sqlText
		.split(";")
		.map((statement) => statement.trim())
		.filter((statement) => {
			if (statement.length === 0) return false;
			// コメント行のみのステートメントを除外
			if (statement.startsWith("--")) return false;
			return true;
		});
}

/**
 * SQLite データベースの自動マイグレーションをアプリ起動時に実行します。
 */
export async function migrateTauriDb(db: SqliteDb | MockSqliteDb) {
	// 1. マイグレーション管理用テーブルを生成
	await db.run(
		`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );`,
	);

	// 2. 適用済みのマイグレーションハッシュの一覧を取得
	const appliedMigrations = await db
		.select({ hash: migrationsTable.hash })
		.from(migrationsTable)
		.execute();

	const appliedHashSet = new Set(appliedMigrations.map((m) => m.hash));

	// 3. バンドルされている SQL ファイルをソートして処理
	const migrationFiles = Object.keys(migrationsGlob).sort();

	for (const filePath of migrationFiles) {
		// パス名からハッシュ値（例: "0000_xxxx"）を生成してキーとする
		const hash = filePath
			.replace(/^.*\/migrations\//, "")
			.replace(/\.sql$/, "");

		// すでに適用済みの場合はスキップ
		if (appliedHashSet.has(hash)) {
			continue;
		}

		const sqlContent = migrationsGlob[filePath].default;
		const statements = parseSqlStatements(sqlContent);

		console.info(`Applying database migration: ${hash}`);

		// Drizzle のトランザクション機能を使用して適用をアトミックに保証
		await db.transaction(async (tx) => {
			// マイグレーション中は外部キー制約の競合を防ぐため一時的に無効化
			await tx.run("PRAGMA foreign_keys = OFF;");

			for (const statement of statements) {
				await tx.run(`${statement};`);
			}

			// バージョン管理テーブルに記録
			await tx.insert(migrationsTable).values({
				hash,
				createdAt: new Date(),
			});

			// マイグレーション完了後に外部キー制約を再有効化
			await tx.run("PRAGMA foreign_keys = ON;");
		});

		console.info(`Migration ${hash} successfully applied.`);
	}
}
