import path from "node:path";

const TABLE_NAME = "media_ccip";
const DEFAULT_DIRECTORY = ".cache/lancedb-ccip";
const REQUIRED_CONFIRMATION = "--confirm-exclusive-access";

async function main(): Promise<void> {
	if (!process.argv.includes(REQUIRED_CONFIRMATION)) {
		throw new Error(
			`Stop every process using the CCIP LanceDB, then rerun with ${REQUIRED_CONFIRMATION}`,
		);
	}

	process.env.LANCE_MEM_POOL_SIZE ??= "536870912";
	const { connect, Index } = await import("@lancedb/lancedb");
	const directoryArgument = process.argv
		.slice(2)
		.find((argument) => argument !== REQUIRED_CONFIRMATION);
	const directory = path.resolve(
		process.cwd(),
		directoryArgument ?? DEFAULT_DIRECTORY,
	);
	const connection = await connect(directory);
	const table = await connection.openTable(TABLE_NAME);

	const rowsBefore = await table.countRows();
	const stats = await table.optimize({
		cleanupOlderThan: new Date(),
		deleteUnverified: true,
	});
	await table.createIndex("mediaId", {
		config: Index.btree(),
		replace: true,
	});
	const rowsAfter = await table.countRows();

	process.stdout.write(
		`${JSON.stringify(
			{
				directory,
				rowsBefore,
				rowsAfter,
				compaction: stats.compaction,
				prune: stats.prune,
			},
			null,
			2,
		)}\n`,
	);
	table.close();
	connection.close();
}

await main();
