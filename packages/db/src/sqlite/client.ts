import Database from "@tauri-apps/plugin-sql";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

/**
 * Tauri のネイティブ SQLite プラグインを使用した Drizzle Proxy データベースを生成します。
 * @param dbPath データベースファイル名 (デフォルト: "solid_imager.db")
 */
export async function createSqliteProxyDb(dbPath = "solid_imager.db") {
	// Tauri 環境下で動作するネイティブ SQLite ドライバを読み込み
	const tauriDb = await Database.load(`sqlite:${dbPath}`);

	// カスケード削除や参照整合性を正しく動作させるため、外部キー制約を有効化
	await tauriDb.execute("PRAGMA foreign_keys = ON;");

	// Drizzle Proxy クライアントの初期化
	return drizzle(
		async (sql, params, method) => {
			try {
				// 1. 書き込み系クエリ (run) の処理
				if (method === "run") {
					await tauriDb.execute(sql, params);
					return { rows: [] };
				}

				// クエリを実行して結果セット (オブジェクトの配列) を取得
				const rows = await tauriDb.select<Record<string, unknown>[]>(
					sql,
					params,
				);

				// 2. カラム値の2次元配列を要求するクエリ (values) の処理
				if (method === "values") {
					const values = rows.map((row) => Object.values(row));
					return { rows: values };
				}

				// 3. 単一レコードを要求するクエリ (get) の処理
				if (method === "get") {
					return { rows: rows.length > 0 ? [rows[0]] : [] };
				}

				// 4. 通常のクエリ (all) の処理
				return { rows };
			} catch (error) {
				console.error("SQLite Proxy Query Error:", { sql, params, error });
				throw error;
			}
		},
		{ schema },
	);
}

export type SqliteDb = Awaited<ReturnType<typeof createSqliteProxyDb>>;
