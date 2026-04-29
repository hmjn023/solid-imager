import type { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import type { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import type * as schema from "./schema";

export type NodePostgresDb = ReturnType<
	typeof drizzleNodePostgres<typeof schema>
>;
export type PgLiteDb = ReturnType<typeof drizzlePglite<typeof schema>>;
export type NodePostgresTransaction = Parameters<
	Parameters<NodePostgresDb["transaction"]>[0]
>[0];
export type PgLiteTransaction = Parameters<
	Parameters<PgLiteDb["transaction"]>[0]
>[0];
export type DrizzleDb = NodePostgresDb | PgLiteDb;
export type DrizzleTransaction = NodePostgresTransaction | PgLiteTransaction;
export type DrizzleExecutor = DrizzleDb | DrizzleTransaction;
export type ExecutorProvider = (tx?: unknown) => DrizzleExecutor;
