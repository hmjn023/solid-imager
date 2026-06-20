/// <reference types="bun-types" />
import { eq } from "drizzle-orm";
import { BackupService } from "../src/application/services/backup-service";
import { initServices } from "../src/infrastructure/bootstrap";
import { db } from "../src/infrastructure/db";
import { mediaSources } from "../src/infrastructure/db/schema";

async function main() {
	// Initialize configuration and registry services
	initServices();

	const args = process.argv.slice(2);
	// usage: bun scripts/sync-lancedb-slow.ts [mediaSourceId] [batchSize] [delayMs]
	const mediaSourceId = args[0] || null;
	const batchSize = args[1] ? Number.parseInt(args[1], 10) : 100;
	const delayMs = args[2] ? Number.parseInt(args[2], 10) : 500;

	if (Number.isNaN(batchSize) || Number.isNaN(delayMs) || batchSize <= 0 || delayMs < 0) {
		console.error(
			"Usage: bun scripts/sync-lancedb-slow.ts [mediaSourceId] [batchSize] [delayMs]\nNote: batchSize must be > 0 and delayMs must be >= 0",
		);
		process.exit(1);
	}

	console.log("📦 Starting slow LanceDB synchronization...");
	console.log(`⚙️ Batch size: ${batchSize}`);
	console.log(`⚙️ Delay: ${delayMs}ms`);

	let sourcesToSync = [];
	if (mediaSourceId && mediaSourceId !== "all") {
		const source = await db.query.mediaSources.findFirst({
			where: eq(mediaSources.id, mediaSourceId),
		});
		if (!source) {
			console.error(`❌ Media source with ID ${mediaSourceId} not found.`);
			process.exit(1);
		}
		sourcesToSync.push(source);
	} else {
		sourcesToSync = await db.query.mediaSources.findMany();
	}

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
