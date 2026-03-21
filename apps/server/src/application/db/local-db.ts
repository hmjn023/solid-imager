import { PGlite } from "@electric-sql/pglite";

// Create a singleton instance of PGlite for local-first database
// Data is stored in IndexedDB in the browser, and in memory/file on the server
let localDbInstance: PGlite | null = null;

export async function getLocalDb(): Promise<PGlite> {
  if (!localDbInstance) {
    // In browser, this uses IndexedDB. In Node/Bun, it uses local file system
    localDbInstance = new PGlite("idb://solid-imager-local-db");
    await localDbInstance.waitReady;

    // Initialize schema if needed (basic setup for syncing)
    await initLocalSchema(localDbInstance);
  }
  return localDbInstance;
}

export async function closeLocalDb(): Promise<void> {
  if (localDbInstance) {
    await localDbInstance.close();
    localDbInstance = null;
  }
}

async function initLocalSchema(db: PGlite): Promise<void> {
  // Add necessary schema initializations for local tables if they don't exist
  // We'll keep this minimal initially and expand as needed for specific collections
  await db.query(`
    CREATE TABLE IF NOT EXISTS sync_metadata (
      collection_name TEXT PRIMARY KEY,
      last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      sync_token TEXT
    );
  `);
}
