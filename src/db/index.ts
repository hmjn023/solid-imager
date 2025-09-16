import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "~/db/schema";

const dbHost = process.env.DB_HOST;
if (!dbHost) {
	throw new Error("DB_HOST is not defined in environment variables.");
}

const dbPort = process.env.DB_PORT;
if (!dbPort) {
	throw new Error("DB_PORT is not defined in environment variables.");
}

const dbUser = process.env.DB_USER;
if (!dbUser) {
	throw new Error("DB_USER is not defined in environment variables.");
}

const dbPassword = process.env.DB_PASSWORD;
if (!dbPassword) {
	throw new Error("DB_PASSWORD is not defined in environment variables.");
}

const dbDatabase = process.env.DB_DATABASE;
if (!dbDatabase) {
	throw new Error("DB_DATABASE is not defined in environment variables.");
}

const pool = new Pool({
	host: dbHost,
	port: parseInt(dbPort, 10),
	user: dbUser,
	password: dbPassword,
	database: dbDatabase,
});

const _db = drizzle(pool, { schema });
