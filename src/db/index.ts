import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { MediaSource, NewMediaSource } from "~/db/schema";
import * as schema from "~/db/schema";
import { mediaSources } from "~/db/schema";

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

export const db = drizzle(pool, { schema });

export const selectMediaSources = () => {
	return db.select().from(mediaSources);
};

export const insertMediaSource = (mediaSource: NewMediaSource) => {
	return db.insert(mediaSources).values(mediaSource).returning();
};

export const updateMediaSource = (
	mediaSourceId: string,
	mediaSource: MediaSource,
) => {
	return db
		.update(mediaSources)
		.set(mediaSource)
		.where(eq(mediaSources.id, mediaSourceId))
		.returning();
};

export const deleteMediaSource = (mediaSourceId: string) => {
	return db
		.delete(mediaSources)
		.where(eq(mediaSources.id, mediaSourceId))
		.returning();
};
