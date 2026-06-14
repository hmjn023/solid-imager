import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import type * as schema from "./schema";

export type DrizzleExecutor =
	| NodePgDatabase<typeof schema>
	| PgliteDatabase<typeof schema>
	| BunSQLDatabase<typeof schema>;
