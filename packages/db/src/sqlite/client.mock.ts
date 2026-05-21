import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

/**
 * テスト/CI用の better-sqlite3 を使用したインメモリ SQLite Proxy データベースを生成します。
 */
export function createMockSqliteDb() {
	// インメモリ上にデータベースを新規構築
	const mockDb = new Database(":memory:");

	// テスト環境でもカスケード削除の挙動を検証するため、外部キー制約を有効化
	mockDb.exec("PRAGMA foreign_keys = ON;");

	return drizzle(
		async (sql, params, method) => {
			try {
				// better-sqlite3 のステートメントをプリペアドとして準備
				const stmt = mockDb.prepare(sql);

				// 1. 書き込み系クエリ (run) の処理
				if (method === "run") {
					stmt.run(params);
					return { rows: [] };
				}

				// 2. カラム値の2次元配列を要求するクエリ (values) の処理
				if (method === "values") {
					const rows = stmt.raw(true).all(params) as unknown[][];
					return { rows };
				}

				// 3. 単一レコードを要求するクエリ (get) の処理
				if (method === "get") {
					const row = stmt.get(params);
					return { rows: row !== undefined ? [row] : [] };
				}

				// 4. 通常のクエリ (all) の処理
				const rows = stmt.all(params);
				return { rows };
			} catch (error) {
				console.error("Mock SQLite Proxy Query Error:", { sql, params, error });
				throw error;
			}
		},
		{ schema },
	);
}

export type MockSqliteDb = ReturnType<typeof createMockSqliteDb>;
