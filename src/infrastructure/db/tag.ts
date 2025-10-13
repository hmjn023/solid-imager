
import { createContextId } from "@builder.io/qwik";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export const Database = createContextId<LibSQLDatabase<typeof schema>>("db_context");
