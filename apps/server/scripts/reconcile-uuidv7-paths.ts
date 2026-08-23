import { readdir, rename, stat } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { getJobTransferRoot } from "../src/infrastructure/services/job-transfer-storage";

type IdMapping = {
	oldId: string;
	newId: string;
};

type EntityIdMapping = IdMapping & {
	entity: string;
};

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getDatabasePool(): Pool {
	const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE } = process.env;
	if (!(DB_HOST && DB_PORT && DB_USER && DB_PASSWORD && DB_DATABASE)) {
		throw new Error(
			"DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, and DB_DATABASE are required",
		);
	}

	return new Pool({
		host: DB_HOST,
		port: Number(DB_PORT),
		user: DB_USER,
		password: DB_PASSWORD,
		database: DB_DATABASE,
	});
}

async function pathExists(targetPath: string): Promise<boolean> {
	return await stat(targetPath)
		.then(() => true)
		.catch(() => false);
}

async function renameIfNeeded(oldPath: string, newPath: string): Promise<boolean> {
	if (!(await pathExists(oldPath))) {
		return false;
	}
	if (await pathExists(newPath)) {
		throw new Error(`Refusing to overwrite existing path: ${newPath}`);
	}
	await rename(oldPath, newPath);
	return true;
}

async function reconcileDirectory(
	directoryPath: string,
	mappings: IdMapping[],
): Promise<number> {
	if (!(await pathExists(directoryPath))) {
		return 0;
	}

	const entries = await readdir(directoryPath, { withFileTypes: true });
	let renamedCount = 0;
	for (const entry of entries) {
		const matchingMapping = mappings.find(({ oldId }) =>
			entry.name.includes(oldId),
		);
		if (!matchingMapping) {
			continue;
		}

		const oldPath = path.join(directoryPath, entry.name);
		const newName = entry.name.replaceAll(
			matchingMapping.oldId,
			matchingMapping.newId,
		);
		const newPath = path.join(directoryPath, newName);
		if (oldPath === newPath) {
			continue;
		}
		renamedCount += Number(await renameIfNeeded(oldPath, newPath));
	}
	return renamedCount;
}

async function reconcileFilesRecursively(
	directoryPath: string,
	mappings: IdMapping[],
): Promise<number> {
	if (!(await pathExists(directoryPath))) {
		return 0;
	}

	const entries = await readdir(directoryPath, { withFileTypes: true });
	let renamedCount = 0;
	for (const entry of entries) {
		const entryPath = path.join(directoryPath, entry.name);
		if (entry.isDirectory()) {
			renamedCount += await reconcileFilesRecursively(entryPath, mappings);
			continue;
		}

		const matchingMapping = mappings.find(({ oldId }) =>
			entry.name.includes(oldId),
		);
		if (!matchingMapping) {
			continue;
		}

		const newPath = path.join(
			directoryPath,
			entry.name.replaceAll(matchingMapping.oldId, matchingMapping.newId),
		);
		renamedCount += Number(await renameIfNeeded(entryPath, newPath));
	}
	return renamedCount;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

async function getThumbnailRoot(): Promise<string> {
	const configuredPath = process.env.CONFIG_PATH
		? path.resolve(process.env.CONFIG_PATH)
		: (await pathExists(path.resolve(process.cwd(), "apps/server")))
			? path.resolve(process.cwd(), "apps/server/config.json")
			: path.resolve(process.cwd(), "config.json");

	let thumbnailDirectory = ".cache/thumbnails";
	try {
		const parsed: unknown = JSON.parse(await readFile(configuredPath, "utf8"));
		if (isRecord(parsed) && isRecord(parsed.storage)) {
			const configuredThumbnailDirectory = parsed.storage.thumbnailDir;
			if (typeof configuredThumbnailDirectory === "string") {
				thumbnailDirectory = configuredThumbnailDirectory;
			}
		}
	} catch {
		// Use the same default as the thumbnail service when config is absent.
	}

	return path.resolve(process.cwd(), thumbnailDirectory);
}

const pool = getDatabasePool();
try {
	const result = await pool.query<EntityIdMapping>(
		`SELECT entity, old_id::text AS "oldId", new_id::text AS "newId"
		 FROM uuidv7_migration_map
		 WHERE entity IN ('jobs', 'media_sources', 'media')`,
	);
	const mappings = result.rows.filter(
		({ oldId, newId }) =>
			UUID_PATTERN.test(oldId) && UUID_PATTERN.test(newId),
	);
	if (mappings.length === 0) {
		process.stdout.write("No UUIDv7 job path mappings found.\n");
	} else {
		const jobMappings = mappings.filter(({ entity }) => entity === "jobs");
		const sourceMappings = mappings.filter(
			({ entity }) => entity === "media_sources",
		);
		const mediaMappings = mappings.filter(({ entity }) => entity === "media");
		const transferRoot = getJobTransferRoot();
		const directories = [
			path.join(transferRoot, "inputs"),
			path.join(transferRoot, "artifacts"),
			path.resolve(transferRoot, "..", "tar-staging"),
		];
		let renamedCount = 0;
		for (const directoryPath of directories) {
			renamedCount += await reconcileDirectory(directoryPath, jobMappings);
		}

		const thumbnailRoot = await getThumbnailRoot();
		renamedCount += await reconcileDirectory(thumbnailRoot, sourceMappings);
		renamedCount += await reconcileFilesRecursively(
			thumbnailRoot,
			mediaMappings,
		);

		process.stdout.write(
			`Reconciled ${renamedCount} path(s) using ${mappings.length} mapping(s).\n`,
		);
	}
} finally {
	await pool.end();
}
