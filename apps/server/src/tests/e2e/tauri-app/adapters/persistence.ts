import type { CollectionConfig } from "@tanstack/db";

type BrowserCollectionOptions<
	T extends object,
	TKey extends string | number,
> = CollectionConfig<T, TKey> & {
	persistence: unknown;
	schemaVersion?: number;
};

/**
 * Browser E2E collections still use their real query functions and query
 * client. Only the native SQLite persistence layer is removed from the
 * collection options so the isolated PGlite server remains the source of
 * truth for every test.
 */
export function persistedCollectionOptions<
	T extends object,
	TKey extends string | number = string | number,
>(
	options: BrowserCollectionOptions<T, TKey>,
): Omit<BrowserCollectionOptions<T, TKey>, "persistence" | "schemaVersion"> {
	const {
		persistence: _persistence,
		schemaVersion: _schemaVersion,
		...collectionOptions
	} = options;
	return collectionOptions;
}

export function createTauriSQLitePersistence(_options: unknown) {
	return {};
}
