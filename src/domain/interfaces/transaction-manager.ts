// Marker type for transaction object (implementation specific)
// Using unknown to ensure domain layer doesn't rely on any properties
export type Transaction = unknown;

export type TransactionManager = {
  transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T>;
};
