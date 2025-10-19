import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
// biome-ignore lint/performance/noNamespaceImport: Drizzle ORM requires the schema as a single object.
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _queryClient: Pool | null = null;

function initializeDb() {
  if (_db) {
    return _db;
  }

  const dbHost = process.env.DB_HOST;
  const dbPort = process.env.DB_PORT || "5432";
  const dbName = process.env.DB_DATABASE || process.env.DB_NAME;
  const dbUser = process.env.DB_USER;
  const dbPassword = process.env.DB_PASSWORD;

  if (!(dbHost && dbName && dbUser && dbPassword)) {
    throw new Error(
      "Database environment variables are not set (DB_HOST, DB_DATABASE/DB_NAME, DB_USER, DB_PASSWORD)"
    );
  }

  const connectionString = `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;
  _queryClient = new Pool({ connectionString });
  _db = drizzle(_queryClient, { schema });
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    const instance = initializeDb();
    const value = instance[prop as keyof typeof instance];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
