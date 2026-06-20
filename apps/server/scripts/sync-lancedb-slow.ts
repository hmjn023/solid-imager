/// <reference types="bun-types" />
import { BackupService } from "../src/application/services/backup-service";
import { initServices } from "../src/infrastructure/bootstrap";
import { db } from "../src/infrastructure/db";

async function main() {
	// Initialize configuration and registry services
	initServices();

	const args = process.argv.slice(2);
	// usage: bun scripts/sync-lancedb-slow.ts [batchSize] [delayMs]
	const batchSize = args[0] ? Number.parseInt(args[0], 10) : 100;
	const delayMs = args[1] ? Number.parseInt(args[1], 10) : 500;

	if (Number.isNaN(batchSize) || Number.isNaN(delayMs) || batchSize <= 0 || delayMs < 0) {
		console.error(
			"Usage: bun scripts/sync-lancedb-slow.ts [batchSize] [delayMs]\nNote: batchSize must be > 0 and delayMs must be >= 0",
		);
		process.exit(1);
	}

	console.log("📦 Starting slow LanceDB synchronization for all sources...");
	console.log(`⚙️ Batch size: ${batchSize}`);
	console.log(`⚙️ Delay: ${delayMs}ms`);

	const sourcesToSync = await db.query.mediaSources.findMany();
	console.log(`📂 Found ${sourcesToSync.length} media source(s) to sync.`);

	for (const source of sourcesToSync) {
		console.log(`🔄 Syncing media source: ${source.name} (${source.id})...`);
		try {
			await BackupService.syncSourceLanceDBCache(source.id, {
				batchSize,
				delayMs,
			});
			console.log(`✅ Successfully synced ${source.name}.`);
		} catch (error) {
			console.error(`❌ Failed to sync source ${source.name}:`, error);
		}
	}

	console.log("🏁 Slow sync script finished.");
}

main().catch((err) => {
	console.error("❌ Script error:", err);
	process.exit(1);
});
