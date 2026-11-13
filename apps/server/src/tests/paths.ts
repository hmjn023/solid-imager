import path from "node:path";

const serverDir = path.resolve(import.meta.dirname, "../..");
export const SERVER_ENV_FILE = path.join(serverDir, ".env");
export const MIGRATIONS_DIR = path.join(serverDir, "drizzle");
export const FIXTURES_DIR = path.join(import.meta.dirname, "fixtures");
