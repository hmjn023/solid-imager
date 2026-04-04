import { getExecutionRuntime } from "~/infrastructure/runtime/execution-runtime";
import {
	createDatabase,
	type DbInstance,
	type NodePostgresDb,
	type PgLiteDb,
} from "./runtime-database";

export type {
	DbInstance,
	NodePostgresDb,
	PgLiteDb,
	TransactionClient,
} from "./runtime-database";

let _db: DbInstance | null = null;
let _queryClient: unknown | null = null;

/**
 * Initializes and returns the Drizzle ORM database instance.
 * This function ensures that the database connection is established only once.
 * It reads database connection details from environment variables.
 * @returns {NodePostgresDb | PgLiteDb} The initialized Drizzle ORM database instance.
 * @throws {Error} If required database environment variables are not set.
 */
function initializeDb() {
	if (_db) {
		return _db;
	}

	const runtime = getExecutionRuntime();
	const initialized = createDatabase(runtime, process.env);
	_queryClient = initialized.queryClient;
	_db = initialized.db;
	return _db;
}

/**
 * A proxy object for the Drizzle ORM database instance.
 * It ensures that the database is initialized lazily upon first access.
 */
export const db = new Proxy({} as NodePostgresDb | PgLiteDb, {
	get(_target, prop) {
		const instance = initializeDb();
		const value = instance[prop as keyof typeof instance];
		return typeof value === "function" ? value.bind(instance) : value;
	},
});
