import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "./schema";

export type NodePostgresDb = NodePgDatabase<typeof schema>;
export type PgLiteDb = PgliteDatabase<typeof schema>;
export type DbInstance = NodePostgresDb | PgLiteDb;
export type TransactionClient = DbInstance;

export function getClient(
	db: DbInstance,
	tx?: Transaction,
): TransactionClient {
	return (tx as TransactionClient | undefined) ?? db;
}

export type DbConfig =
	| {
			databaseType: "pglite";
			pglite: { path?: string; inMemory?: boolean };
	  }
	| {
			databaseType: "docker-compose-postgres";
			dockerComposePostgres: {
				host: string;
				port: number;
				user: string;
				password: string;
				database: string;
			};
	  };
