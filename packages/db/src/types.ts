import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type * as schema from "./schema";

/** Supported Drizzle database executors used by repositories. */
export type DrizzleExecutor =
	| BunSQLDatabase<typeof schema>
	| NodePgDatabase<typeof schema>
	| PgliteDatabase<typeof schema>;
