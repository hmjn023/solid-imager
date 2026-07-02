import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Connection, Table } from "@lancedb/lancedb";
import type { MediaDumpItem } from "@solid-imager/core/domain/media/schemas";
import type { DataType, Schema } from "apache-arrow";
import type {
	ILanceDbDumpService,
	MediaDumpItemWithImageData,
	ReadOptions,
	SyncDeltaOptions,
	SyncOptions,
	WriteOptions,
} from "../ports/lancedb-dump-service";

const ROW_CHUNK_SIZE = 5000;
const READ_CHUNK_SIZE = 5000;
export const LANCEDB_DUMP_VERSION = 4;

async function updateLanceDbManifestVersion(lanceDbDir: string): Promise<void> {
	const manifestPath = path.join(lanceDbDir, "manifest.json");
	let manifest: unknown;
	try {
		manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
	} catch {
		return;
	}
	if (
		typeof manifest !== "object" ||
		manifest === null ||
		Array.isArray(manifest)
	) {
		return;
	}
	await fs.writeFile(
		manifestPath,
		JSON.stringify({ ...manifest, version: LANCEDB_DUMP_VERSION }, null, 2),
	);
}

type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };
type RowValue = JsonValue | Date;
type Row = Record<string, RowValue>;

type LanceConnectFn = (uri: string) => Promise<Connection>;

type TableRows = {
	media: Row[];
	tags: Row[];
	authors: Row[];
	characters: Row[];
	characterIps: Row[];
	ips: Row[];
	projects: Row[];
	urls: Row[];
	generationInfo: Row[];
};

type TableName =
	| "media"
	| "media_tags"
	| "media_authors"
	| "media_characters"
	| "media_character_ips"
	| "media_ips"
	| "media_projects"
	| "media_urls"
	| "media_generation_info";

const tableNames: TableName[] = [
	"media",
	"media_tags",
	"media_authors",
	"media_characters",
	"media_character_ips",
	"media_ips",
	"media_projects",
	"media_urls",
	"media_generation_info",
];

type LanceTables = Record<TableName, Table>;

function resolveSafeChildPath(
	baseDir: string,
	relativePath: string,
): string | null {
	if (!relativePath || path.isAbsolute(relativePath)) return null;
	const resolvedBase = path.resolve(baseDir);
	const resolvedPath = path.resolve(resolvedBase, relativePath);
	const childRelative = path.relative(resolvedBase, resolvedPath);
	if (
		childRelative === "" ||
		childRelative.startsWith("..") ||
		path.isAbsolute(childRelative)
	) {
		return null;
	}
	return resolvedPath;
}

async function createSchema(
	fields: Array<[string, DataType, boolean?]>,
): Promise<Schema> {
	const arrow = await import("apache-arrow");
	return new arrow.Schema(
		fields.map(
			([name, type, nullable]) => new arrow.Field(name, type, nullable ?? true),
		),
	);
}

async function createSchemas(): Promise<Record<TableName, Schema>> {
	const arrow = await import("apache-arrow");
	const utf8 = () => new arrow.Utf8();
	const float64 = () => new arrow.Float64();
	const bool = () => new arrow.Bool();
	const timestamp = () => new arrow.TimestampMillisecond();
	return {
		media: await createSchema([
			["id", utf8()],
			["filePath", utf8()],
			["fileName", utf8()],
			["description", utf8()],
			["width", float64()],
			["height", float64()],
			["fileSize", float64()],
			["mediaType", utf8()],
			["createdAt", timestamp()],
			["modifiedAt", timestamp()],
		]),
		media_tags: await createSchema([
			["key", utf8(), false],
			["mediaId", utf8()],
			["name", utf8()],
			["type", utf8()],
			["confidence", float64()],
			["source", utf8()],
		]),
		media_authors: await createSchema([
			["key", utf8(), false],
			["mediaId", utf8()],
			["name", utf8()],
			["accountId", utf8()],
			["platform", utf8()],
		]),
		media_characters: await createSchema([
			["key", utf8(), false],
			["mediaId", utf8()],
			["name", utf8()],
			["description", utf8()],
			["confidence", float64()],
			["source", utf8()],
		]),
		media_character_ips: await createSchema([
			["key", utf8(), false],
			["mediaId", utf8()],
			["characterName", utf8()],
			["ipName", utf8()],
		]),
		media_ips: await createSchema([
			["key", utf8(), false],
			["mediaId", utf8()],
			["name", utf8()],
			["description", utf8()],
			["confidence", float64()],
			["source", utf8()],
		]),
		media_projects: await createSchema([
			["key", utf8(), false],
			["mediaId", utf8()],
			["name", utf8()],
			["description", utf8()],
		]),
		media_urls: await createSchema([
			["key", utf8(), false],
			["mediaId", utf8()],
			["url", utf8()],
		]),
		media_generation_info: await createSchema([
			["key", utf8(), false],
			["mediaId", utf8()],
			["prompt", utf8()],
			["negativePrompt", utf8()],
			["modelName", utf8()],
			["seed", float64()],
			["steps", float64()],
			["cfgScale", float64()],
			["aiGenerated", bool()],
			["workflowJson", utf8()],
			["metadataJson", utf8()],
		]),
	};
}

function itemId(item: MediaDumpItem, index: number): string {
	return item.id || item.filePath || `item-${index}`;
}

function rowKey(...parts: Array<string | number | null | undefined>): string {
	return parts.map((part) => String(part ?? "")).join(":");
}

function itemsToRows(items: MediaDumpItem[]): TableRows {
	const rows: TableRows = {
		media: [],
		tags: [],
		authors: [],
		characters: [],
		characterIps: [],
		ips: [],
		projects: [],
		urls: [],
		generationInfo: [],
	};
	items.forEach((item, index) => {
		const mediaId = itemId(item, index);
		rows.media.push({
			id: mediaId,
			filePath: item.filePath ?? null,
			fileName: item.fileName ?? null,
			description: item.description ?? null,
			width: item.width ?? null,
			height: item.height ?? null,
			fileSize: item.fileSize ?? null,
			mediaType: item.mediaType ?? null,
			createdAt: item.createdAt ? new Date(item.createdAt) : null,
			modifiedAt: item.modifiedAt ? new Date(item.modifiedAt) : null,
		});

		for (const tag of item.tags ?? [])
			rows.tags.push({
				key: rowKey(mediaId, tag.name, tag.type),
				mediaId,
				name: tag.name,
				type: tag.type ?? null,
				confidence: tag.confidence ?? null,
				source: tag.source ?? null,
			});
		for (const author of item.authors ?? [])
			rows.authors.push({
				key: rowKey(mediaId, author.name, author.platform, author.accountId),
				mediaId,
				name: author.name,
				accountId: author.accountId ?? null,
				platform: author.platform ?? null,
			});
		for (const character of item.characters ?? []) {
			rows.characters.push({
				key: rowKey(mediaId, character.name),
				mediaId,
				name: character.name,
				description: character.description ?? null,
				confidence: character.confidence ?? null,
				source: character.source ?? null,
			});
			for (const ipName of character.linkedIps ?? [])
				rows.characterIps.push({
					key: rowKey(mediaId, character.name, ipName),
					mediaId,
					characterName: character.name,
					ipName,
				});
		}
		for (const ip of item.ips ?? [])
			rows.ips.push({
				key: rowKey(mediaId, ip.name),
				mediaId,
				name: ip.name,
				description: ip.description ?? null,
				confidence: ip.confidence ?? null,
				source: ip.source ?? null,
			});
		for (const project of item.projects ?? [])
			rows.projects.push({
				key: rowKey(mediaId, project.name),
				mediaId,
				name: project.name,
				description: project.description ?? null,
			});
		for (const url of item.sourceUrls ?? [])
			rows.urls.push({ key: rowKey(mediaId, url), mediaId, url });
		if (item.generationInfo) {
			rows.generationInfo.push({
				key: rowKey(mediaId),
				mediaId,
				prompt: item.generationInfo.prompt ?? null,
				negativePrompt: item.generationInfo.negativePrompt ?? null,
				modelName: item.generationInfo.modelName ?? null,
				seed: item.generationInfo.seed ?? null,
				steps: item.generationInfo.steps ?? null,
				cfgScale: item.generationInfo.cfgScale ?? null,
				aiGenerated: item.generationInfo.aiGenerated ?? null,
				workflowJson:
					item.generationInfo.workflow == null
						? null
						: JSON.stringify(item.generationInfo.workflow),
				metadataJson:
					item.generationInfo.metadata == null
						? null
						: JSON.stringify(item.generationInfo.metadata),
			});
		}
	});
	return rows;
}

async function addChunked(table: Table, rows: Row[]): Promise<void> {
	for (let i = 0; i < rows.length; i += ROW_CHUNK_SIZE) {
		await table.add(rows.slice(i, i + ROW_CHUNK_SIZE));
	}
}

async function createTable(
	db: Connection,
	schemas: Record<string, Schema>,
	name: string,
	rows: Row[],
): Promise<Table> {
	const initialRows = rows.slice(0, ROW_CHUNK_SIZE);
	const table = await db.createTable(name, initialRows, {
		mode: "overwrite",
		schema: schemas[name],
	});
	if (rows.length > ROW_CHUNK_SIZE)
		await addChunked(table, rows.slice(ROW_CHUNK_SIZE));
	return table;
}

async function createTables(
	db: Connection,
	schemas: Record<string, Schema>,
	rows: TableRows,
): Promise<LanceTables> {
	const [
		media,
		mediaTags,
		mediaAuthors,
		mediaCharacters,
		mediaCharacterIps,
		mediaIps,
		mediaProjects,
		mediaUrls,
		mediaGenerationInfo,
	] = await Promise.all([
		createTable(db, schemas, "media", rows.media),
		createTable(db, schemas, "media_tags", rows.tags),
		createTable(db, schemas, "media_authors", rows.authors),
		createTable(db, schemas, "media_characters", rows.characters),
		createTable(db, schemas, "media_character_ips", rows.characterIps),
		createTable(db, schemas, "media_ips", rows.ips),
		createTable(db, schemas, "media_projects", rows.projects),
		createTable(db, schemas, "media_urls", rows.urls),
		createTable(db, schemas, "media_generation_info", rows.generationInfo),
	]);
	return {
		media,
		media_tags: mediaTags,
		media_authors: mediaAuthors,
		media_characters: mediaCharacters,
		media_character_ips: mediaCharacterIps,
		media_ips: mediaIps,
		media_projects: mediaProjects,
		media_urls: mediaUrls,
		media_generation_info: mediaGenerationInfo,
	};
}

async function addRowsToTables(
	tables: LanceTables,
	rows: TableRows,
): Promise<void> {
	await Promise.all([
		addChunked(tables.media, rows.media),
		addChunked(tables.media_tags, rows.tags),
		addChunked(tables.media_authors, rows.authors),
		addChunked(tables.media_characters, rows.characters),
		addChunked(tables.media_character_ips, rows.characterIps),
		addChunked(tables.media_ips, rows.ips),
		addChunked(tables.media_projects, rows.projects),
		addChunked(tables.media_urls, rows.urls),
		addChunked(tables.media_generation_info, rows.generationInfo),
	]);
}

async function openTables(db: Connection): Promise<LanceTables> {
	return {
		media: await db.openTable("media"),
		media_tags: await db.openTable("media_tags"),
		media_authors: await db.openTable("media_authors"),
		media_characters: await db.openTable("media_characters"),
		media_character_ips: await db.openTable("media_character_ips"),
		media_ips: await db.openTable("media_ips"),
		media_projects: await db.openTable("media_projects"),
		media_urls: await db.openTable("media_urls"),
		media_generation_info: await db.openTable("media_generation_info"),
	};
}

async function migrateLanceDbSchema(tables: LanceTables): Promise<void> {
	const authorSchema = await tables.media_authors.schema();
	if (!authorSchema.fields.some((field) => field.name === "platform")) {
		await tables.media_authors.addColumns([
			{
				name: "platform",
				valueSql: "CAST(NULL AS STRING)",
			},
		]);
	}
}

function sqlInList(values: string[]): string {
	return values.map((value) => `'${escapeLanceSqlString(value)}'`).join(",");
}

async function deleteMediaRows(
	tables: LanceTables,
	mediaIds: string[],
): Promise<void> {
	if (mediaIds.length === 0) return;
	const ids = sqlInList(mediaIds);
	await Promise.all([
		tables.media.delete(`id IN (${ids})`),
		tables.media_tags.delete(`mediaId IN (${ids})`),
		tables.media_authors.delete(`mediaId IN (${ids})`),
		tables.media_characters.delete(`mediaId IN (${ids})`),
		tables.media_character_ips.delete(`mediaId IN (${ids})`),
		tables.media_ips.delete(`mediaId IN (${ids})`),
		tables.media_projects.delete(`mediaId IN (${ids})`),
		tables.media_urls.delete(`mediaId IN (${ids})`),
		tables.media_generation_info.delete(`mediaId IN (${ids})`),
	]);
}

async function readPage(
	table: Table,
	offset: number,
	limit: number,
): Promise<Row[]> {
	return table.query().limit(limit).offset(offset).toArray();
}

function escapeLanceSqlString(value: string): string {
	return value.replaceAll("'", "''");
}

async function readRowsForMediaIds(
	table: Table,
	mediaIds: string[],
): Promise<Row[]> {
	if (mediaIds.length === 0) return [];
	const ids = mediaIds.map((id) => `'${escapeLanceSqlString(id)}'`).join(",");
	return table.query().where(`mediaId IN (${ids})`).toArray();
}

function mediaIdsFromRows(rows: Row[]): string[] {
	return rows.flatMap((row) => {
		const id = safeString(row.id);
		return id ? [id] : [];
	});
}

async function readRelatedRows(
	tables: Record<Exclude<TableName, "media">, Table>,
	mediaRows: Row[],
): Promise<Record<string, Row[]>> {
	const mediaIds = mediaIdsFromRows(mediaRows);
	const [
		tags,
		authors,
		characters,
		characterIps,
		ips,
		projects,
		urls,
		generationInfo,
	] = await Promise.all([
		readRowsForMediaIds(tables.media_tags, mediaIds),
		readRowsForMediaIds(tables.media_authors, mediaIds),
		readRowsForMediaIds(tables.media_characters, mediaIds),
		readRowsForMediaIds(tables.media_character_ips, mediaIds),
		readRowsForMediaIds(tables.media_ips, mediaIds),
		readRowsForMediaIds(tables.media_projects, mediaIds),
		readRowsForMediaIds(tables.media_urls, mediaIds),
		readRowsForMediaIds(tables.media_generation_info, mediaIds),
	]);
	return {
		media: mediaRows,
		media_tags: tags,
		media_authors: authors,
		media_characters: characters,
		media_character_ips: characterIps,
		media_ips: ips,
		media_projects: projects,
		media_urls: urls,
		media_generation_info: generationInfo,
	};
}

function safeString(value: RowValue | undefined): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function safeNumber(value: RowValue | undefined): number | undefined {
	return typeof value === "number" ? value : undefined;
}

function safeJson(value: RowValue | undefined): JsonValue | undefined {
	if (typeof value !== "string") return undefined;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function groupByMediaId(rows: Row[]): Map<string, Row[]> {
	const grouped = new Map<string, Row[]>();
	for (const row of rows) {
		const mediaId = safeString(row.mediaId);
		if (!mediaId) continue;
		const values = grouped.get(mediaId) ?? [];
		values.push(row);
		grouped.set(mediaId, values);
	}
	return grouped;
}

function rowsToItems(
	tableRows: Record<string, Row[]>,
): MediaDumpItemWithImageData[] {
	const tags = groupByMediaId(tableRows.media_tags ?? []);
	const authors = groupByMediaId(tableRows.media_authors ?? []);
	const characters = groupByMediaId(tableRows.media_characters ?? []);
	const characterIps = groupByMediaId(tableRows.media_character_ips ?? []);
	const ips = groupByMediaId(tableRows.media_ips ?? []);
	const projects = groupByMediaId(tableRows.media_projects ?? []);
	const urls = groupByMediaId(tableRows.media_urls ?? []);
	const generationInfo = groupByMediaId(tableRows.media_generation_info ?? []);

	return (tableRows.media ?? []).map((media) => {
		const id = safeString(media.id) ?? "";
		const linkedIpsByCharacter = new Map<string, string[]>();
		for (const row of characterIps.get(id) ?? []) {
			const characterName = safeString(row.characterName);
			const ipName = safeString(row.ipName);
			if (!(characterName && ipName)) continue;
			const values = linkedIpsByCharacter.get(characterName) ?? [];
			values.push(ipName);
			linkedIpsByCharacter.set(characterName, values);
		}
		const gen = generationInfo.get(id)?.[0];
		return {
			id: safeString(media.id),
			filePath: safeString(media.filePath),
			fileName: safeString(media.fileName),
			description: safeString(media.description),
			width: safeNumber(media.width),
			height: safeNumber(media.height),
			fileSize: safeNumber(media.fileSize),
			mediaType:
				media.mediaType === "image" ||
				media.mediaType === "video" ||
				media.mediaType === "audio"
					? media.mediaType
					: undefined,
			createdAt: dateFromRowValue(media.createdAt),
			modifiedAt: dateFromRowValue(media.modifiedAt),
			tags: (tags.get(id) ?? []).map((row) => ({
				name: safeString(row.name) ?? "",
				type:
					row.type === "positive" || row.type === "negative"
						? row.type
						: undefined,
				confidence: safeNumber(row.confidence),
				source: safeString(row.source),
			})),
			authors: (authors.get(id) ?? []).map((row) => ({
				name: safeString(row.name) ?? "",
				accountId: safeString(row.accountId),
				platform:
					row.platform === "twitter" ||
					row.platform === "pixiv-fanbox" ||
					row.platform === "danbooru"
						? row.platform
						: undefined,
			})),
			characters: (characters.get(id) ?? []).map((row) => {
				const name = safeString(row.name) ?? "";
				return {
					name,
					description: safeString(row.description),
					confidence: safeNumber(row.confidence),
					linkedIps: linkedIpsByCharacter.get(name) ?? [],
					source: safeString(row.source),
				};
			}),
			ips: (ips.get(id) ?? []).map((row) => ({
				name: safeString(row.name) ?? "",
				description: safeString(row.description),
				confidence: safeNumber(row.confidence),
				source: safeString(row.source),
			})),
			projects: (projects.get(id) ?? []).map((row) => ({
				name: safeString(row.name) ?? "",
				description: safeString(row.description),
			})),
			sourceUrls: (urls.get(id) ?? []).flatMap((row) => {
				const url = safeString(row.url);
				return url ? [url] : [];
			}),
			generationInfo: gen
				? {
						prompt: safeString(gen.prompt),
						negativePrompt: safeString(gen.negativePrompt),
						modelName: safeString(gen.modelName),
						seed: safeNumber(gen.seed),
						steps: safeNumber(gen.steps),
						cfgScale: safeNumber(gen.cfgScale),
						aiGenerated:
							typeof gen.aiGenerated === "boolean"
								? gen.aiGenerated
								: undefined,
						workflow: jsonObject(safeJson(gen.workflowJson)),
						metadata: jsonObject(safeJson(gen.metadataJson)),
					}
				: undefined,
		};
	});
}

function dateFromRowValue(value: RowValue | undefined): Date | undefined {
	if (value instanceof Date) return value;
	if (typeof value === "string" || typeof value === "number")
		return new Date(value);
	return undefined;
}

function jsonObject(
	value: JsonValue | undefined,
): Record<string, JsonValue> | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value))
		return undefined;
	return value;
}

export function createLanceDbDumpService(deps?: {
	logger?: {
		info(msg: string, data?: JsonValue): void;
		error(msg: string, data?: JsonValue): void;
	};
	connect?: LanceConnectFn;
}): ILanceDbDumpService {
	const log = deps?.logger ?? { info() {}, error() {} };

	async function getConnect(): Promise<LanceConnectFn> {
		if (deps?.connect) return deps.connect;
		const lancedb = await import("@lancedb/lancedb");
		return (uri: string) => lancedb.connect(uri);
	}

	async function writeToLanceDB(
		items: MediaDumpItem[],
		options: WriteOptions,
	): Promise<string> {
		const baseDir =
			options.tempDir ?? path.join(process.cwd(), ".cache", "lancedb-dump");
		const tempDir = path.join(
			baseDir,
			`dump-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
		);
		await fs.mkdir(tempDir, { recursive: true });
		try {
			const connect = await getConnect();
			const db = await connect(tempDir);
			const schemas = await createSchemas();
			const rows = itemsToRows(items);
			const tables = await createTables(db, schemas, rows);
			await Promise.all(
				Object.values(tables).map((table) =>
					table.optimize({
						cleanupOlderThan: new Date(Date.now() - 1000 * 60 * 5),
					}),
				),
			);
			await fs.writeFile(
				path.join(tempDir, "manifest.json"),
				JSON.stringify(
					{
						format: "solid-imager-lancedb",
						version: LANCEDB_DUMP_VERSION,
						includeImages: options.includeImages,
						createdAt: new Date().toISOString(),
						tables: tableNames,
					},
					null,
					2,
				),
			);
			log.info("LanceDB v2 dump created", {
				path: tempDir,
				count: items.length,
			});
			return tempDir;
		} catch (error) {
			await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
			throw error;
		}
	}

	async function syncLanceDB(
		lanceDbDir: string,
		itemsToUpsert: MediaDumpItem[],
		_options: SyncOptions = {},
	): Promise<void> {
		await fs.rm(lanceDbDir, { recursive: true, force: true });
		const createdDir = await writeToLanceDB(itemsToUpsert, {
			includeImages: false,
			tempDir: path.dirname(lanceDbDir),
		});
		await fs.rm(lanceDbDir, { recursive: true, force: true });
		await fs.rename(createdDir, lanceDbDir);
	}

	async function writePagesToLanceDB(
		itemPages: AsyncIterable<MediaDumpItem[]>,
		options: WriteOptions,
	): Promise<{ dir: string; count: number }> {
		const baseDir =
			options.tempDir ?? path.join(process.cwd(), ".cache", "lancedb-dump");
		const tempDir = path.join(
			baseDir,
			`dump-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
		);
		await fs.mkdir(tempDir, { recursive: true });
		let count = 0;
		try {
			const connect = await getConnect();
			const db = await connect(tempDir);
			const schemas = await createSchemas();
			const tables = await createTables(db, schemas, itemsToRows([]));

			for await (const items of itemPages) {
				if (items.length === 0) continue;
				count += items.length;
				await addRowsToTables(tables, itemsToRows(items));
			}

			await Promise.all(
				Object.values(tables).map((table) =>
					table.optimize({
						cleanupOlderThan: new Date(Date.now() - 1000 * 60 * 5),
					}),
				),
			);
			await fs.writeFile(
				path.join(tempDir, "manifest.json"),
				JSON.stringify(
					{
						format: "solid-imager-lancedb",
						version: LANCEDB_DUMP_VERSION,
						includeImages: options.includeImages,
						createdAt: new Date().toISOString(),
						tables: tableNames,
					},
					null,
					2,
				),
			);
			log.info("LanceDB v2 dump created", { path: tempDir, count });
			return { dir: tempDir, count };
		} catch (error) {
			await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
			throw error;
		}
	}

	async function syncLanceDBPages(
		lanceDbDir: string,
		itemPages: AsyncIterable<MediaDumpItem[]>,
		_options: SyncOptions = {},
	): Promise<number> {
		await fs.rm(lanceDbDir, { recursive: true, force: true });
		const created = await writePagesToLanceDB(itemPages, {
			includeImages: false,
			tempDir: path.dirname(lanceDbDir),
		});
		await fs.rm(lanceDbDir, { recursive: true, force: true });
		await fs.rename(created.dir, lanceDbDir);
		return created.count;
	}

	async function syncLanceDBDelta(
		lanceDbDir: string,
		options: SyncDeltaOptions,
	): Promise<{ deleted: number; upserted: number }> {
		const mediaIdsToDelete = options.mediaIdsToDelete ?? [];
		const itemsToUpsert = options.itemsToUpsert ?? [];
		const upsertIds = itemsToUpsert.flatMap((item, index) => {
			const id = itemId(item, index);
			return id ? [id] : [];
		});
		const targetIds = [...new Set([...mediaIdsToDelete, ...upsertIds])];
		if (targetIds.length === 0) {
			return { deleted: 0, upserted: 0 };
		}

		const connect = await getConnect();
		const db = await connect(lanceDbDir);
		const tables = await openTables(db);
		await migrateLanceDbSchema(tables);
		await deleteMediaRows(tables, targetIds);
		await addRowsToTables(tables, itemsToRows(itemsToUpsert));
		await updateLanceDbManifestVersion(lanceDbDir);

		if (options.optimize) {
			await Promise.all(
				Object.values(tables).map((table) =>
					table.optimize({
						cleanupOlderThan: new Date(Date.now() - 1000 * 60 * 5),
					}),
				),
			);
		}

		return { deleted: mediaIdsToDelete.length, upserted: itemsToUpsert.length };
	}

	async function readFromLanceDB(
		lanceDbDir: string,
		options: ReadOptions = {},
	): Promise<MediaDumpItemWithImageData[]> {
		const connect = await getConnect();
		const db = await connect(lanceDbDir);
		const mediaTable = await db.openTable("media");
		const relatedTables = {
			media_tags: await db.openTable("media_tags"),
			media_authors: await db.openTable("media_authors"),
			media_characters: await db.openTable("media_characters"),
			media_character_ips: await db.openTable("media_character_ips"),
			media_ips: await db.openTable("media_ips"),
			media_projects: await db.openTable("media_projects"),
			media_urls: await db.openTable("media_urls"),
			media_generation_info: await db.openTable("media_generation_info"),
		};
		const allItems: MediaDumpItemWithImageData[] = [];
		let offset = 0;
		while (true) {
			const mediaRows = await readPage(mediaTable, offset, READ_CHUNK_SIZE);
			if (mediaRows.length === 0) break;
			const tableRows = await readRelatedRows(relatedTables, mediaRows);
			const items = rowsToItems(tableRows);
			if (options.extractImages && options.saveImageBuffer) {
				await Promise.all(
					items.map(async (item) => {
						if (!item.filePath) return;
						const externalPath = resolveSafeChildPath(
							path.join(lanceDbDir, "images"),
							item.filePath,
						);
						if (!externalPath) return;
						try {
							await options.saveImageBuffer?.(
								item.filePath,
								await fs.readFile(externalPath),
							);
						} catch {}
					}),
				);
			}
			if (options.onChunk) {
				await options.onChunk(items);
			} else {
				allItems.push(...items);
			}
			if (mediaRows.length < READ_CHUNK_SIZE) break;
			offset += mediaRows.length;
		}
		log.info("LanceDB v2 dump read", {
			path: lanceDbDir,
			count: allItems.length,
		});
		return allItems;
	}

	async function readMediaIds(lanceDbDir: string): Promise<string[]> {
		const connect = await getConnect();
		const db = await connect(lanceDbDir);
		const mediaTable = await db.openTable("media");
		const rows = await mediaTable.query().select(["id"]).toArray();
		return rows.flatMap((row) => {
			const id = safeString(row.id);
			return id ? [id] : [];
		});
	}

	async function readMediaFilePaths(
		lanceDbDir: string,
	): Promise<{ id: string; filePath: string | undefined }[]> {
		const connect = await getConnect();
		const db = await connect(lanceDbDir);
		const mediaTable = await db.openTable("media");
		const rows = await mediaTable.query().select(["id", "filePath"]).toArray();
		return rows.flatMap((row) => {
			const id = safeString(row.id);
			return id ? [{ id, filePath: safeString(row.filePath) }] : [];
		});
	}

	async function cleanupLanceDBDir(dir: string): Promise<void> {
		await fs.rm(dir, { recursive: true, force: true });
	}

	return {
		writeToLanceDB,
		syncLanceDB,
		syncLanceDBPages,
		syncLanceDBDelta,
		readFromLanceDB,
		readMediaIds,
		readMediaFilePaths,
		cleanupLanceDBDir,
	};
}
