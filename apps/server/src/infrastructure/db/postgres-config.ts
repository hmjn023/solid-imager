export function readPostgresConfig(env = process.env) {
	return {
		host: env.DB_HOST || env.PGHOST,
		port: env.PGPORT || env.DB_PORT || "5432",
		database:
			env.POSTGRES_DB || env.DB_DATABASE || env.DB_NAME || env.PGDATABASE,
		user: env.POSTGRES_USER || env.DB_USER || env.PGUSER,
		password: env.POSTGRES_PASSWORD || env.DB_PASSWORD || env.PGPASSWORD,
	};
}
