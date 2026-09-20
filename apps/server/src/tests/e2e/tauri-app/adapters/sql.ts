export type QueryResult = {
	rowsAffected: number;
	lastInsertId?: number;
};

/**
 * The browser fixture deliberately bypasses native SQLite persistence. The
 * persistence adapter below removes that layer, while this class keeps the
 * production module's Database.load() call observable and harmless.
 */
export default class Database {
	constructor(public readonly path: string) {}

	static async load(path: string): Promise<Database> {
		return new Database(path);
	}

	async execute(_query: string, _bindValues?: unknown[]): Promise<QueryResult> {
		throw new Error(
			"The Tauri E2E fixture must not execute native SQLite statements",
		);
	}

	async select<T>(_query: string, _bindValues?: unknown[]): Promise<T> {
		throw new Error("The Tauri E2E fixture must not select from native SQLite");
	}

	async close(): Promise<boolean> {
		return true;
	}
}
