import path from "node:path";
import { services } from "../src/application/registry";
import { initServices } from "../src/infrastructure/bootstrap";

const TABLE_NAME = "media_ccip";
const REQUIRED_CONFIRMATION = "--confirm-exclusive-access";

async function main(): Promise<void> {
	if (!process.argv.includes(REQUIRED_CONFIRMATION)) {
		throw new Error(
			`Stop every process using the CCIP LanceDB, then rerun with ${REQUIRED_CONFIRMATION}`,
		);
	}

	process.env.LANCE_MEM_POOL_SIZE ??= "536870912";
	const { connect, Index } = await import("@lancedb/lancedb");

	initServices();
	const config = services.getConfigService().getConfig();
	const directoryArgument = process.argv
		.slice(2)
		.find((argument) => argument !== REQUIRED_CONFIRMATION);
	const directory = path.resolve(
		process.cwd(),
		directoryArgument ?? config.lancedb.ccipVectorDir,
	);
	const connection = await connect(directory);
	try {
		const table = await connection.openTable(TABLE_NAME);
		try {
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
		} finally {
			table.close();
		}
	} finally {
		connection.close();
	}
}

await main();
