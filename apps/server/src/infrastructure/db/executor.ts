import type { DrizzleExecutor } from "@solid-imager/db";
import { db } from "~/infrastructure/db/index";

function isTransactionClient(value: unknown): value is DrizzleExecutor {
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
