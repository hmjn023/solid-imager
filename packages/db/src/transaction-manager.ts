import type {
	Transaction,
	TransactionManager,
} from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { DbInstance } from "./types";

export function createTransactionManager(
	db: DbInstance,
): TransactionManager {
	return {
		async transaction<T>(
			callback: (tx: Transaction) => Promise<T>,
		): Promise<T> {
			return await db.transaction(async (tx) => {
				return await callback(tx);
			});
		},
	};
}
