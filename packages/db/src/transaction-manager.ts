import type {
	Transaction,
	TransactionManager,
} from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { DrizzleExecutor } from "./types";

export function createTransactionManager(
	getExecutor: () => DrizzleExecutor,
): TransactionManager {
	return {
		async transaction<T>(
			callback: (tx: Transaction) => Promise<T>,
		): Promise<T> {
			const db = getExecutor();
			return await (db as { transaction: typeof db.transaction }).transaction(async (tx) => {
				return await callback(tx as Transaction);
			});
		},
	};
}
