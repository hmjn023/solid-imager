export const DEFAULT_POSTGRES_DRIVER = "bun-sql" as const;

export type PostgresDriver = "bun-sql" | "node-postgres";

/**
 * Resolves the PostgreSQL implementation used by the server.
 *
 * Bun.SQL is the default. The node-postgres path remains available as an
 * explicit escape hatch for deployments that still depend on pg-specific
 * behavior (for example COPY, LISTEN/NOTIFY, or PostGIS extensions).
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
