/// <reference types="bun-types" />
import { $ } from "bun";
import { mkdir } from "node:fs/promises";
import path from "node:path";

// Load environment variables
const DB_USER = process.env.DB_USER || "postgres";
const DB_DATABASE = process.env.DB_DATABASE || "solid-imager";
const CONTAINER_NAME = "solid-imager-db-1"; // Assuming default naming convention, or retrieve from docker-compose

// Backup configuration
const BACKUP_DIR = "backups";
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-");
const FILENAME = `backup-${TIMESTAMP}.sql`;
const FILEPATH = path.join(BACKUP_DIR, FILENAME);

console.log("📦 Starting database backup...");

try {
  // Ensure backup directory exists
  await mkdir(BACKUP_DIR, { recursive: true });

  // Determine container name dynamically if possible, or use a consistent name
  // Using 'docker compose ps' to find the container name for service 'db'
  const containerNameOutput = await $`docker compose ps -q db`.text();
  const containerId = containerNameOutput.trim();

  if (!containerId) {
    console.error("❌ Could not find running database container. Is Docker Compose up?");
    process.exit(1);
  }

  console.log(`🐳 Found database container ID: ${containerId}`);
  console.log(`📂 Saving backup to: ${FILEPATH}`);

  // Execute pg_dump inside the container
  // We use Bun.spawn to pipe stdout directly to a file
  // Note: We avoid passing password via CLI args for security, relying on .pgpass or trust in container,
  // but standard postgres image usually allows 'postgres' user without pass locally or env var.
  // Since we are exec-ing AS the user inside container, auth usually works.
  
  // Using -U (user) and -d (database)
  await $`docker exec -t ${containerId} pg_dump -U ${DB_USER} -d ${DB_DATABASE} --clean --if-exists > ${FILEPATH}`;

  console.log("✅ Backup completed successfully!");
} catch (error) {
  console.error("❌ Backup failed:", error);
  process.exit(1);
}