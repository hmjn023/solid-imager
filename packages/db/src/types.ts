import type { PgAsyncDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { relations } from "./relations";

/** Supported Drizzle database executors used by repositories. */
export type DrizzleExecutor = PgAsyncDatabase<
	PgQueryResultHKT,
	typeof relations
>;
