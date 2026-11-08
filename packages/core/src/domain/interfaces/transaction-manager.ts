/** Opaque, implementation-specific transaction handle passed to repositories. */
export type Transaction = unknown;

/** Runs work within a transaction managed by the infrastructure implementation. */
export type TransactionManager = {
	transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T>;
};
