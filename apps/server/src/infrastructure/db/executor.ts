import type { DrizzleExecutor } from "@solid-imager/db/types";
import { db, type TransactionClient } from "~/infrastructure/db/index";

export function getExecutor(tx?: unknown): DrizzleExecutor {
	return (tx as unknown as TransactionClient) || (db as unknown as DrizzleExecutor);
}
