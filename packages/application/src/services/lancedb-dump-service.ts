import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { MediaDumpItem } from "@solid-imager/core/domain/media/schemas";
import type {
	ILanceDbDumpService,
	MediaDumpItemWithImageData,
	ReadOptions,
	WriteOptions,
} from "../ports/lancedb-dump-service";

const METADATA_CHUNK_SIZE = 1000;
const IMAGE_CHUNK_SIZE = 100;

async function createMediaSchema(): Promise<import("apache-arrow").Schema> {
	const arrow = await import("apache-arrow");
	return new arrow.Schema([
		new arrow.Field("id", new arrow.Utf8(), true),
		new arrow.Field("filePath", new arrow.Utf8(), true),
		new arrow.Field("fileName", new arrow.Utf8(), true),
		new arrow.Field("description", new arrow.Utf8(), true),
		new arrow.Field("width", new arrow.Float64(), true),
		new arrow.Field("height", new arrow.Float64(), true),
		new arrow.Field("fileSize", new arrow.Float64(), true),
		new arrow.Field("mediaType", new arrow.Utf8(), true),
		new arrow.Field("createdAt", new arrow.TimestampMillisecond(), true),
		new arrow.Field("modifiedAt", new arrow.TimestampMillisecond(), true),
		new arrow.Field("imageData", new arrow.Binary(), true),
		new arrow.Field(
			"tags",
			new arrow.List(
				new arrow.Field(
					"",
					new arrow.Struct([
						new arrow.Field("name", new arrow.Utf8()),
						new arrow.Field("type", new arrow.Utf8(), true),
						new arrow.Field("confidence", new arrow.Float64(), true),
						new arrow.Field("source", new arrow.Utf8(), true),
					]),
				),
			),
			true,
		),
		new arrow.Field(
			"authors",
			new arrow.List(
				new arrow.Field(
					"",
					new arrow.Struct([
						new arrow.Field("name", new arrow.Utf8()),
						new arrow.Field("accountId", new arrow.Utf8(), true),
					]),
				),
			),
			true,
		),
		new arrow.Field(
			"characters",
			new arrow.List(
				new arrow.Field(
					"",
					new arrow.Struct([
						new arrow.Field("name", new arrow.Utf8()),
						new arrow.Field("description", new arrow.Utf8(), true),
						new arrow.Field("confidence", new arrow.Float64(), true),
						new arrow.Field(
							"linkedIps",
							new arrow.List(new arrow.Field("item", new arrow.Utf8())),
							true,
						),
						new arrow.Field("source", new arrow.Utf8(), true),
					]),
				),
			),
			true,
		),
		new arrow.Field(
			"ips",
			new arrow.List(
				new arrow.Field(
					"",
					new arrow.Struct([
						new arrow.Field("name", new arrow.Utf8()),
						new arrow.Field("description", new arrow.Utf8(), true),
						new arrow.Field("confidence", new arrow.Float64(), true),
						new arrow.Field("source", new arrow.Utf8(), true),
					]),
				),
			),
			true,
		),
		new arrow.Field(
			"projects",
			new arrow.List(
				new arrow.Field(
					"",
					new arrow.Struct([
						new arrow.Field("name", new arrow.Utf8()),
						new arrow.Field("description", new arrow.Utf8(), true),
					]),
				),
			),
			true,
		),
		new arrow.Field(
			"sourceUrls",
			new arrow.List(new arrow.Field("item", new arrow.Utf8())),
			true,
		),
		new arrow.Field(
			"generationInfo",
			new arrow.Struct([
				new arrow.Field("prompt", new arrow.Utf8(), true),
				new arrow.Field("negativePrompt", new arrow.Utf8(), true),
				new arrow.Field("modelName", new arrow.Utf8(), true),
				new arrow.Field("seed", new arrow.Float64(), true),
				new arrow.Field("steps", new arrow.Float64(), true),
				new arrow.Field("cfgScale", new arrow.Float64(), true),
				new arrow.Field("aiGenerated", new arrow.Bool(), true),
				new arrow.Field("workflow", new arrow.Utf8(), true),
				new arrow.Field("metadata", new arrow.Utf8(), true),
			]),
			true,
		),
	]);
}

function itemToRow(
	item: MediaDumpItem,
	imageData?: Buffer,
): Record<string, unknown> {
	const generationInfo = item.generationInfo
		? {
				prompt: item.generationInfo.prompt ?? null,
				negativePrompt: item.generationInfo.negativePrompt ?? null,
				modelName: item.generationInfo.modelName ?? null,
				seed: item.generationInfo.seed ?? null,
				steps: item.generationInfo.steps ?? null,
				cfgScale: item.generationInfo.cfgScale ?? null,
				aiGenerated: item.generationInfo.aiGenerated ?? null,
				workflow:
					item.generationInfo.workflow != null
						? JSON.stringify(item.generationInfo.workflow)
						: null,
				metadata:
					item.generationInfo.metadata != null
						? JSON.stringify(item.generationInfo.metadata)
						: null,
			}
		: null;

	return {
		id: item.id ?? null,
		filePath: item.filePath ?? null,
		fileName: item.fileName ?? null,
		description: item.description ?? null,
		width: item.width ?? null,
		height: item.height ?? null,
		fileSize: item.fileSize ?? null,
		mediaType: item.mediaType ?? null,
		createdAt: item.createdAt ? new Date(item.createdAt) : null,
		modifiedAt: item.modifiedAt ? new Date(item.modifiedAt) : null,
		imageData: imageData ?? null,
		tags:
			item.tags?.map((t) => ({
				name: t.name,
				type: t.type ?? null,
				confidence: t.confidence ?? null,
				source: t.source ?? null,
			})) ?? null,
		authors:
			item.authors?.map((a) => ({
				name: a.name,
				accountId: a.accountId ?? null,
			})) ?? null,
		characters:
			item.characters?.map((c) => ({
				name: c.name,
				description: c.description ?? null,
				confidence: c.confidence ?? null,
				linkedIps: c.linkedIps ?? null,
				source: c.source ?? null,
			})) ?? null,
		ips:
			item.ips?.map((i) => ({
				name: i.name,
				description: i.description ?? null,
				confidence: i.confidence ?? null,
				source: i.source ?? null,
			})) ?? null,
		projects:
			item.projects?.map((p) => ({
				name: p.name,
				description: p.description ?? null,
			})) ?? null,
		sourceUrls: item.sourceUrls ?? null,
		generationInfo,
	};
}

function toArray(value: unknown): unknown[] | undefined {
	if (Array.isArray(value)) {
		return value;
	}
	if (value && typeof value === "object" && "toArray" in value) {
		return (value as { toArray: () => unknown[] }).toArray();
	}
	if (value && typeof value === "object" && Symbol.iterator in value) {
		return Array.from(value as Iterable<unknown>);
	}
	return undefined;
}

function safeJsonParse(value: unknown): unknown {
	if (typeof value !== "string") {
		return value;
	}
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function rowToItem(
	row: Record<string, unknown>,
	includeImageData: boolean,
): MediaDumpItemWithImageData {
	const generationInfoRaw = row.generationInfo as Record<
		string,
		unknown
	> | null;
	const generationInfo = generationInfoRaw
		? {
				prompt: (generationInfoRaw.prompt as string | undefined) ?? undefined,
				negativePrompt:
					(generationInfoRaw.negativePrompt as string | undefined) ?? undefined,
				modelName:
					(generationInfoRaw.modelName as string | undefined) ?? undefined,
				seed: (generationInfoRaw.seed as number | undefined) ?? undefined,
				steps: (generationInfoRaw.steps as number | undefined) ?? undefined,
				cfgScale:
					(generationInfoRaw.cfgScale as number | undefined) ?? undefined,
				aiGenerated:
					(generationInfoRaw.aiGenerated as boolean | undefined) ?? undefined,
				workflow: generationInfoRaw.workflow
					? (safeJsonParse(generationInfoRaw.workflow) as
							| Record<string, unknown>
							| undefined)
					: undefined,
				metadata: generationInfoRaw.metadata
					? (safeJsonParse(generationInfoRaw.metadata) as
							| Record<string, unknown>
							| undefined)
					: undefined,
			}
		: undefined;

	const tagsArr = toArray(row.tags);
	const authorsArr = toArray(row.authors);
	const charactersArr = toArray(row.characters);
	const ipsArr = toArray(row.ips);
	const projectsArr = toArray(row.projects);
	const sourceUrlsArr = toArray(row.sourceUrls);

	const safeString = (v: unknown): string | undefined =>
		typeof v === "string" ? v : undefined;
	const safeNumber = (v: unknown): number | undefined =>
		typeof v === "number" ? v : undefined;

	const item: MediaDumpItemWithImageData = {
		id: safeString(row.id),
		filePath: safeString(row.filePath),
		fileName: safeString(row.fileName),
		description: safeString(row.description),
		width: safeNumber(row.width),
		height: safeNumber(row.height),
		fileSize: safeNumber(row.fileSize),
		mediaType:
			row.mediaType === "image" ||
			row.mediaType === "video" ||
			row.mediaType === "audio"
				? row.mediaType
				: undefined,
		createdAt: row.createdAt
			? new Date(row.createdAt as string | number)
			: undefined,
		modifiedAt: row.modifiedAt
			? new Date(row.modifiedAt as string | number)
			: undefined,
		tags: tagsArr?.map((t) => {
			const obj = t as Record<string, unknown>;
			return {
				name: safeString(obj.name) ?? "",
				type: (obj.type as "positive" | "negative" | undefined) ?? undefined,
				confidence: safeNumber(obj.confidence),
				source: safeString(obj.source),
			};
		}),
		authors: authorsArr?.map((a) => {
			const obj = a as Record<string, unknown>;
			return {
				name: safeString(obj.name) ?? "",
				accountId: safeString(obj.accountId),
			};
		}),
		characters: charactersArr?.map((c) => {
			const obj = c as Record<string, unknown>;
			return {
				name: safeString(obj.name) ?? "",
				description: safeString(obj.description),
				confidence: safeNumber(obj.confidence),
				linkedIps: toArray(obj.linkedIps) as string[] | undefined,
				source: safeString(obj.source),
			};
		}),
		ips: ipsArr?.map((i) => {
			const obj = i as Record<string, unknown>;
			return {
				name: safeString(obj.name) ?? "",
				description: safeString(obj.description),
				confidence: safeNumber(obj.confidence),
				source: safeString(obj.source),
			};
		}),
		projects: projectsArr?.map((p) => {
			const obj = p as Record<string, unknown>;
			return {
				name: safeString(obj.name) ?? "",
				description: safeString(obj.description),
			};
		}),
		sourceUrls: sourceUrlsArr?.filter(
			(u): u is string => typeof u === "string",
		),
		generationInfo,
	};

	if (includeImageData && row.imageData) {
		item._imageData = row.imageData as Uint8Array;
	}

	return item;
}

type TableLike = {
	add(rows: Record<string, unknown>[]): Promise<void>;
	mergeInsert(key: string): {
		whenMatchedUpdateAll(): {
			execute(rows: Record<string, unknown>[]): Promise<void>;
		};
	};
	optimize(opts?: Record<string, unknown>): Promise<void>;
	query(): {
		limit(n: number): {
			offset(n: number): {
				toArray(): Promise<Record<string, unknown>[]>;
			};
		};
	};
};

type LanceDbLike = {
	createTable: (
		name: string,
		data: Record<string, unknown>[],
		opts?: Record<string, unknown>,
	) => Promise<TableLike>;
	openTable: (name: string) => Promise<TableLike>;
};

type LanceConnectFn = (
	uri: string,
	opts?: Record<string, unknown>,
) => Promise<LanceDbLike>;

export function createLanceDbDumpService(deps?: {
	logger?: {
		info(msg: string, data?: unknown): void;
		error(msg: string, data?: unknown): void;
	};
	connect?: LanceConnectFn;
}): ILanceDbDumpService {
	const log = deps?.logger ?? { info() {}, error() {} };

	function extractConnectFn(mod: { connect: unknown }): LanceConnectFn {
		return mod.connect as LanceConnectFn;
	}

	async function getConnect(): Promise<LanceConnectFn> {
		if (deps?.connect) return deps.connect;
		const lancedb = await import("@lancedb/lancedb");
		return extractConnectFn(lancedb);
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
			const schema = await createMediaSchema();

			let table: TableLike | null = null;

			// Phase 1: Write metadata only (without imageData)
			for (let i = 0; i < items.length; i += METADATA_CHUNK_SIZE) {
				const chunk = items.slice(i, i + METADATA_CHUNK_SIZE);
				const rows: Record<string, unknown>[] = [];

				for (const item of chunk) {
					rows.push(itemToRow(item));
				}

				if (table === null) {
					table = await db.createTable("media", rows, {
						mode: "overwrite",
						schema,
					});
				} else {
					await table.add(rows);
				}

				log.info("LanceDB metadata chunk written", {
					chunk: Math.floor(i / METADATA_CHUNK_SIZE) + 1,
					total: items.length,
				});
			}

			// Phase 2: Fetch images concurrently and update via mergeInsert
			if (options.includeImages && options.getImageBuffer && table) {
				for (let i = 0; i < items.length; i += IMAGE_CHUNK_SIZE) {
					const chunk = items.slice(i, i + IMAGE_CHUNK_SIZE);

					const imagePromises = chunk.map(async (item) => {
						if (!item.filePath) return null;
						try {
							return await options.getImageBuffer?.(item.filePath);
						} catch {
							return null;
						}
					});

					const imageDatas = await Promise.all(imagePromises);

					const imageRows = imageDatas.flatMap((data, j) =>
						data ? [{ id: chunk[j].id, imageData: data }] : [],
					);

					if (imageRows.length > 0) {
						await table
							.mergeInsert("id")
							.whenMatchedUpdateAll()
							.execute(imageRows);
					}

					log.info("LanceDB image chunk updated", {
						chunk: Math.floor(i / IMAGE_CHUNK_SIZE) + 1,
						total: items.length,
					});
				}
			}

			if (table) {
				await table.optimize({ cleanupOlderThan: new Date(Date.now() - 1000 * 60 * 5) });
			}

			log.info("LanceDB dump created", {
				path: tempDir,
				count: items.length,
			});
			return tempDir;
		} catch (error) {
			await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
			throw error;
		}
	}

	async function readFromLanceDB(
		lanceDbDir: string,
		options: ReadOptions = {},
	): Promise<MediaDumpItemWithImageData[]> {
		const connect = await getConnect();
		const db = await connect(lanceDbDir);
		const table = await db.openTable("media");

		const allItems: MediaDumpItemWithImageData[] = [];
		let offset = 0;
		let chunkIndex = 0;
		const includeImageData = options.extractImages ?? false;

		while (true) {
			const rows = await table
				.query()
				.limit(includeImageData ? IMAGE_CHUNK_SIZE : METADATA_CHUNK_SIZE)
				.offset(offset)
				.toArray();

			if (rows.length === 0) {
				break;
			}

			const chunk: MediaDumpItemWithImageData[] = [];

			const savePromises: Promise<void>[] = [];
			for (const row of rows as Record<string, unknown>[]) {
				const item = rowToItem(row, includeImageData);
				chunk.push(item);

				if (
					options.extractImages &&
					options.saveImageBuffer &&
					item._imageData
				) {
					if (item.filePath) {
						savePromises.push(
							options.saveImageBuffer(
								item.filePath,
								Buffer.from(item._imageData),
							),
						);
					}
				}
			}

			if (savePromises.length > 0) {
				await Promise.all(savePromises);
			}

			if (options.onChunk) {
				await options.onChunk(chunk);
			} else {
				allItems.push(...chunk);
			}

			chunkIndex++;
			log.info("LanceDB chunk read", {
				chunk: chunkIndex,
				count: rows.length,
			});

			if (
				rows.length <
				(includeImageData ? IMAGE_CHUNK_SIZE : METADATA_CHUNK_SIZE)
			) {
				break;
			}

			offset += rows.length;
		}

		log.info("LanceDB dump read", {
			path: lanceDbDir,
			count: allItems.length,
		});
		return allItems;
	}

	async function cleanupLanceDBDir(dir: string): Promise<void> {
		await fs.rm(dir, { recursive: true, force: true });
	}

	return { writeToLanceDB, readFromLanceDB, cleanupLanceDBDir };
}
