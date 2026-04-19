/// <reference types="bun-types" />
import { $ } from "bun";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

// Load environment variables
const DB_USER = process.env.DB_USER || "postgres";
const DB_DATABASE = process.env.DB_DATABASE || "solid-imager";
const BACKUP_DIR = "backups";

// Get target backup file from args or find latest
const args = process.argv.slice(2);
let targetFile = args[0];

if (!targetFile) {
	try {
		// Check if backup directory exists
		const dirStats = await stat(BACKUP_DIR).catch(() => null);
		if (!dirStats || !dirStats.isDirectory()) {
			console.error(`❌ Backup directory '${BACKUP_DIR}' not found.`);
			process.exit(1);
		}

		const files = await readdir(BACKUP_DIR);
		const sqlFiles = files.filter((f) => f.endsWith(".sql"));

		if (sqlFiles.length === 0) {
			console.error("❌ No backup files found in backups/ directory.");
			process.exit(1);
		}

		// Sort by modification time desc to get the latest
		const fileStats = await Promise.all(
			sqlFiles.map(async (file) => {
				const filePath = path.join(BACKUP_DIR, file);
				const stats = await stat(filePath);
				return { file, mtime: stats.mtime.getTime() };
			}),
		);

		fileStats.sort((a, b) => b.mtime - a.mtime);
		targetFile = path.join(BACKUP_DIR, fileStats[0].file);
		console.log(`ℹ️  No file specified. Using latest backup: ${targetFile}`);
	} catch (error) {
		console.error("❌ Error finding backup files:", error);
		process.exit(1);
	}
} else {
	// Validate provided file exists
	try {
		await stat(targetFile);
	} catch {
		console.error(`❌ Specified backup file not found: ${targetFile}`);
		process.exit(1);
	}
}

console.log(
	`\n⚠️  WARNING: This will OVERWRITE the database '${DB_DATABASE}' with data from '${targetFile}'.`,
);
console.log("⚠️  Current data in the database will be lost/modified.");
console.log("⏳ Starting in 5 seconds... Press Ctrl+C to cancel.");

await new Promise((r) => setTimeout(r, 1000));
process.stdout.write("5...");
await new Promise((r) => setTimeout(r, 1000));
process.stdout.write(" 4...");
await new Promise((r) => setTimeout(r, 1000));
process.stdout.write(" 3...");
await new Promise((r) => setTimeout(r, 1000));
process.stdout.write(" 2...");
await new Promise((r) => setTimeout(r, 1000));
process.stdout.write(" 1...\n");

console.log("📦 Starting database restore...");

try {
	// Find container
	const containerNameOutput = await $`docker compose ps -q db`.text();
	const containerId = containerNameOutput.trim();

	if (!containerId) {
		console.error("❌ Could not find running database container. Is Docker Compose up?");
		process.exit(1);
	}

	console.log(`🐳 Found database container ID: ${containerId}`);

	// Execute restore
	// We use Bun.file to read the SQL file and pipe it into the docker exec command
	const fileInput = Bun.file(targetFile);

	// Note: -i is required for docker exec to accept stdin
	await $`docker exec -i ${containerId} psql -U ${DB_USER} -d ${DB_DATABASE} < ${fileInput}`;

	console.log("✅ Restore completed successfully!");
} catch (error) {
	console.error("❌ Restore failed:", error);
	process.exit(1);
}
