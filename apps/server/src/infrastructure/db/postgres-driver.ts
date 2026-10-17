export const DEFAULT_POSTGRES_DRIVER = "node-postgres" as const;

export type PostgresDriver = "bun-sql" | "node-postgres";

/**
 * Resolves the PostgreSQL implementation used by the server.
 *
 * Keep pg as the default: Bun 1.4.3 double-encodes Drizzle's serialized JSONB
 * parameters, breaking JSON operators and durable processing constraints.
 * Bun.SQL remains opt-in for runtimes that pass validate:bun-sql.
 */
export function resolvePostgresDriver(
	value: string | undefined = process.env.DB_POSTGRES_DRIVER,
): PostgresDriver {
	const normalized = value?.trim().toLowerCase();

	if (!normalized) {
		return DEFAULT_POSTGRES_DRIVER;
	}

	if (normalized === "bun-sql" || normalized === "node-postgres") {
		return normalized;
	}

	throw new Error(
		`Invalid DB_POSTGRES_DRIVER: ${value}. Expected "bun-sql" or "node-postgres".`,
	);
}
