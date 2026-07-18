import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";

/**
 * Creates a PGlite client with the same pgvector extension that PostgreSQL
 * uses in production. Migrations still run `CREATE EXTENSION vector`; passing
 * the extension here makes that SQL available in every local/test runtime.
 */
export function createPglite(dataDir?: string): PGlite {
	const options = { extensions: { vector } };
	return dataDir ? new PGlite(dataDir, options) : new PGlite(options);
}
