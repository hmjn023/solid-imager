import path from "node:path";
import { createDbClient } from "@solid-imager/db/client";
import { createTransactionManager } from "@solid-imager/db/transaction-manager";
import type {
	DbConfig,
	DbInstance,
	TransactionClient,
} from "@solid-imager/db/types";
import type { DatabaseConfig } from "~/config/database";

export type { TransactionClient };

function _convertConfig(config: DatabaseConfig): DbConfig {
	return config as DbConfig;
}

let _db: DbInstance | null = null;

function initializeDb(config?: DatabaseConfig): DbInstance {
	if (_db) {
		return _db;
	}

	const dbConfig = config ?? {
		databaseType: "pglite" as const,
		pglite: {
			path:
				process.env.PGLITE_DATA_DIR ||
				path.join(process.cwd(), ".data", "pglite"),
		},
	};

	_db = createDbClient(dbConfig);
	return _db;
}

const dbProxy = new Proxy({} as DbInstance, {
	get(_target, prop) {
		const instance = initializeDb();
		const value = instance[prop as keyof typeof instance];
		return typeof value === "function" ? value.bind(instance) : value;
	},
});

export const db = dbProxy;
export const DrizzleTransactionManager = createTransactionManager(dbProxy);

export function initializeDatabase(config: DatabaseConfig): DbInstance {
	return initializeDb(config);
}
