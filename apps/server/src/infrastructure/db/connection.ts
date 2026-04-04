import type { DatabaseConfig } from "~/config/database";
import {
	closeDbConnection,
	createConnectionFromConfig,
	type DbConnection,
} from "./runtime-database";

export type { DbConnection } from "./runtime-database";

export async function createConnection(
	config: DatabaseConfig,
): Promise<DbConnection> {
	return createConnectionFromConfig(config);
}

export async function closeConnection(connection: DbConnection): Promise<void> {
	await closeDbConnection(connection);
}
