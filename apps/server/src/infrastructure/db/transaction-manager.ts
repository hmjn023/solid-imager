import type {
  Transaction,
  TransactionManager,
} from "@solid-imager/core/domain/interfaces/transaction-manager";
import { db } from "~/infrastructure/db/index";

export const DrizzleTransactionManager: TransactionManager = {
  async transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
    return await db.transaction(async (tx) => {
      // Pass the Drizzle transaction object as the opaque Transaction type
      return await callback(tx);
    });
  },
};
