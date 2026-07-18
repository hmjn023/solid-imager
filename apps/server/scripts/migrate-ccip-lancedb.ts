import type { CcipVectorRecord } from "@solid-imager/application/ports/ccip-vector-store";
import { z } from "zod";
import { services } from "../src/application/registry";
import { PostgresCcipVectorStore } from "../src/infrastructure/ai/postgres-ccip-vector-store";
import { LanceDbCcipVectorStore } from "../src/infrastructure/ai/lancedb-ccip-vector-store";
import { initServices } from "../src/infrastructure/bootstrap";
import { db } from "../src/infrastructure/db";
import { logger } from "../src/infrastructure/logger";

const usage =
	"Usage: bun scripts/migrate-ccip-lancedb.ts [--dry-run] [--source-id <uuid>] [--batch-size <positive integer>]";
const uuidSchema = z.string().uuid();

type MigrationOptions = {
	dryRun: boolean;
	mediaSourceId?: string;
	batchSize: number;
};

function parsePositiveInteger(value: string, name: string): number {
	if (!/^\d+$/.test(value)) {
		throw new Error(`${name} must be a positive integer`);
	}
	const parsed = Number.parseInt(value, 10);
	if (!Number.isSafeInteger(parsed) || parsed < 1) {
		throw new Error(`${name} must be a positive integer`);
	}
	return parsed;
}

function parseOptions(args: string[]): MigrationOptions {
	const options: MigrationOptions = { dryRun: false, batchSize: 100 };
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (argument === "--dry-run") {
			options.dryRun = true;
			continue;
		}
		if (argument === "--source-id") {
			const value = args[index + 1];
			if (!value) throw new Error("--source-id requires a UUID");
			options.mediaSourceId = uuidSchema.parse(value);
			index += 1;
			continue;
		}
		if (argument === "--batch-size") {
			const value = args[index + 1];
			if (!value) throw new Error("--batch-size requires a value");
			options.batchSize = parsePositiveInteger(value, "--batch-size");
			index += 1;
			continue;
		}
		throw new Error(`Unknown argument: ${argument}`);
	}
	return options;
}

function migrationKey(record: CcipVectorRecord): string {
	return `${record.mediaId}:${record.model}:${record.embeddingVersion}`;
}

function recordsMatch(left: CcipVectorRecord, right: CcipVectorRecord): boolean {
	return (
		left.mediaSourceId === right.mediaSourceId &&
		left.mediaModifiedAt.getTime() === right.mediaModifiedAt.getTime() &&
		left.vector.length === right.vector.length &&
		left.vector.every((value, index) => value === right.vector[index])
	);
}

function collapseRecords(records: CcipVectorRecord[]): {
	records: CcipVectorRecord[];
	collapsedDuplicates: number;
} {
	const byKey = new Map<string, CcipVectorRecord>();
	let collapsedDuplicates = 0;
	for (const record of records) {
		const key = migrationKey(record);
		const existing = byKey.get(key);
		if (!existing) {
			byKey.set(key, record);
			continue;
		}
		if (!recordsMatch(existing, record)) {
			throw new Error(`Conflicting LanceDB CCIP records for ${key}`);
		}
		collapsedDuplicates += 1;
		if (record.extractedAt.getTime() > existing.extractedAt.getTime()) {
			byKey.set(key, record);
		}
	}
	return { records: [...byKey.values()], collapsedDuplicates };
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	if (args.includes("--help") || args.includes("-h")) {
		process.stdout.write(`${usage}\n`);
		return;
	}
	const options = parseOptions(args);
	initServices();
	const config = services.getConfigService().getConfig();
	const legacyStore = new LanceDbCcipVectorStore(config.lancedb.ccipVectorDir, {
		readOnly: true,
	});
	const rawRecords = await legacyStore.list({
		mediaSourceId: options.mediaSourceId,
	});
	const collapsed = collapseRecords(rawRecords);

	logger.info(
		{
			dryRun: options.dryRun,
			mediaSourceId: options.mediaSourceId,
			rawRows: rawRecords.length,
			uniqueLogicalRows: collapsed.records.length,
			collapsedDuplicates: collapsed.collapsedDuplicates,
			batchSize: options.batchSize,
		},
		"CCIP LanceDB migration prepared",
	);

	if (options.dryRun) {
		return;
	}

	const targetStore = new PostgresCcipVectorStore(db);
	for (let start = 0; start < collapsed.records.length; start += options.batchSize) {
		const batch = collapsed.records.slice(start, start + options.batchSize);
		await targetStore.upsertMany(batch);
		logger.info(
			{
				migrated: Math.min(start + batch.length, collapsed.records.length),
				total: collapsed.records.length,
			},
			"CCIP LanceDB migration batch completed",
		);
	}

	logger.info(
		{
			rawRows: rawRecords.length,
			uniqueLogicalRows: collapsed.records.length,
			collapsedDuplicates: collapsed.collapsedDuplicates,
		},
		"CCIP LanceDB migration completed",
	);
}

main().catch((error: unknown) => {
	logger.error({ err: error }, "CCIP LanceDB migration failed");
	process.exitCode = 1;
});
