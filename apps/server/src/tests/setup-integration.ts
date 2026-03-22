import path from "node:path";
import { config } from "dotenv";
import { beforeAll, beforeEach, vi } from "vite-plus/test";

// Bootstrap
beforeAll(async () => {
	const { bootstrap } = await import("~/infrastructure/bootstrap");
	bootstrap();
});

config({ path: path.resolve(process.cwd(), ".env") });

process.env.DB_HOST = "pglite";
if (process.env.NODE_ENV !== "production") {
	process.env.NODE_ENV = "test";
}

const { mockDbFactory } = vi.hoisted(() => {
	let dbInstance: { db: unknown } | null = null;
	return {
		mockDbFactory: async () => {
			if (dbInstance) {
				return dbInstance;
			}

			const { PGlite } = await import("@electric-sql/pglite");
			const { drizzle } = await import("drizzle-orm/pglite");
			const { migrate } = await import("drizzle-orm/pglite/migrator");
			const schema = await import("~/infrastructure/db/schema");
			const nodePath = await import("node:path");

			const client = new PGlite();
			const testDb = drizzle(client, { schema });
			const migrationsFolder = process.cwd().endsWith("apps/server")
				? nodePath.resolve(process.cwd(), "drizzle")
				: nodePath.resolve(process.cwd(), "apps/server/drizzle");
			await migrate(testDb, { migrationsFolder });

			dbInstance = { db: testDb };
			return dbInstance;
		},
	};
});

vi.mock("~/infrastructure/db", mockDbFactory);
vi.mock("~/infrastructure/db/index", mockDbFactory);

beforeEach(() => {
	vi.clearAllMocks();
});
