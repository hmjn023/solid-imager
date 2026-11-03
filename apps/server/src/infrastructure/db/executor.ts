import type { DrizzleExecutor } from "@solid-imager/db";
import { db, type TransactionClient } from "~/infrastructure/db/index";

function isTransactionClient(value: unknown): value is TransactionClient {
	return (
		value !== null &&
		typeof value === "object" &&
		"select" in value &&
		"insert" in value
	);
}

export function getExecutor(tx?: unknown): DrizzleExecutor {
	return isTransactionClient(tx) ? tx : db;
}
