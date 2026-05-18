import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { MediaDumpItem } from "@solid-imager/core/domain/media/schemas";
import { logger } from "~/infrastructure/logger";

const CHUNK_SIZE = 1000;

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

function rowToItem(row: Record<string, unknown>): MediaDumpItem {
	const generationInfoRaw = row.generationInfo as Record<
		string,
		unknown
	> | null;
	const generationInfo = generationInfoRaw
		? {
				prompt: (generationInfoRaw.prompt as string) ?? undefined,
				negativePrompt:
					(generationInfoRaw.negativePrompt as string) ?? undefined,
				modelName: (generationInfoRaw.modelName as string) ?? undefined,
				seed: (generationInfoRaw.seed as number) ?? undefined,
				steps: (generationInfoRaw.steps as number) ?? undefined,
				cfgScale: (generationInfoRaw.cfgScale as number) ?? undefined,
				aiGenerated: (generationInfoRaw.aiGenerated as boolean) ?? undefined,
				workflow: generationInfoRaw.workflow
					? JSON.parse(generationInfoRaw.workflow as string)
					: undefined,
				metadata: generationInfoRaw.metadata
					? JSON.parse(generationInfoRaw.metadata as string)
					: undefined,
			}
		: undefined;

	return {
		id: (row.id as string) ?? undefined,
		filePath: (row.filePath as string) ?? undefined,
		fileName: (row.fileName as string) ?? undefined,
		description: (row.description as string) ?? undefined,
		width: (row.width as number) ?? undefined,
		height: (row.height as number) ?? undefined,
		fileSize: (row.fileSize as number) ?? undefined,
		mediaType: (row.mediaType as "image" | "video" | "audio") ?? undefined,
		createdAt: row.createdAt
			? new Date(row.createdAt as string | number)
			: undefined,
		modifiedAt: row.modifiedAt
			? new Date(row.modifiedAt as string | number)
			: undefined,
		tags: (row.tags as Array<Record<string, unknown>>)?.map((t) => ({
			name: t.name as string,
			type: (t.type as "positive" | "negative") ?? undefined,
			confidence: (t.confidence as number) ?? undefined,
			source: (t.source as string) ?? undefined,
		})),
		authors: (row.authors as Array<Record<string, unknown>>)?.map((a) => ({
			name: a.name as string,
			accountId: (a.accountId as string) ?? undefined,
		})),
		characters: (row.characters as Array<Record<string, unknown>>)?.map(
			(c) => ({
				name: c.name as string,
				description: (c.description as string) ?? undefined,
				confidence: (c.confidence as number) ?? undefined,
				linkedIps: (c.linkedIps as string[]) ?? undefined,
				source: (c.source as string) ?? undefined,
			}),
		),
		ips: (row.ips as Array<Record<string, unknown>>)?.map((i) => ({
			name: i.name as string,
			description: (i.description as string) ?? undefined,
			confidence: (i.confidence as number) ?? undefined,
			source: (i.source as string) ?? undefined,
		})),
		projects: (row.projects as Array<Record<string, unknown>>)?.map((p) => ({
			name: p.name as string,
			description: (p.description as string) ?? undefined,
		})),
		sourceUrls: (row.sourceUrls as string[]) ?? undefined,
		generationInfo,
	};
}

export async function writeToLanceDB(
	items: MediaDumpItem[],
	options: {
		includeImages: boolean;
		getImageBuffer?: (filePath: string) => Promise<Buffer | null>;
		tempDir?: string;
	},
): Promise<string> {
	const baseDir =
		options.tempDir ?? path.join(process.cwd(), ".cache", "lancedb-dump");
	const tempDir = path.join(baseDir, `dump-${Date.now()}`);
	await fs.mkdir(tempDir, { recursive: true });

	try {
		const lancedb = await import("@lancedb/lancedb");
		const db = await lancedb.connect(tempDir);
		const schema = await createMediaSchema();

		let table: import("@lancedb/lancedb").Table | null = null;

		for (let i = 0; i < items.length; i += CHUNK_SIZE) {
			const chunk = items.slice(i, i + CHUNK_SIZE);
			const rows: Record<string, unknown>[] = [];

			for (const item of chunk) {
				let imageData: Buffer | undefined;
				if (options.includeImages && options.getImageBuffer && item.filePath) {
					const buf = await options.getImageBuffer(item.filePath);
					if (buf) {
						imageData = buf;
					}
				}
				rows.push(itemToRow(item, imageData));
			}

			if (table === null) {
				table = await db.createTable("media", rows, {
					mode: "overwrite",
					schema,
				});
			} else {
				await table.add(rows);
			}

			logger.info(
				{ chunk: Math.floor(i / CHUNK_SIZE) + 1, total: items.length },
				"LanceDB chunk written",
			);
		}

		if (table) {
			await table.optimize({ cleanupOlderThan: new Date() });
		}

		logger.info({ path: tempDir, count: items.length }, "LanceDB dump created");
		return tempDir;
	} catch (error) {
		await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
		throw error;
	}
}

export async function readFromLanceDB(
	lanceDbDir: string,
	options: {
		extractImages?: boolean;
		saveImageBuffer?: (filePath: string, buffer: Buffer) => Promise<void>;
	} = {},
): Promise<MediaDumpItem[]> {
	const lancedb = await import("@lancedb/lancedb");
	const db = await lancedb.connect(lanceDbDir);
	const table = await db.openTable("media");
	const rows = await table.query().toArray();

	const items: MediaDumpItem[] = [];

	for (const row of rows as Record<string, unknown>[]) {
		const item = rowToItem(row);

		if (options.extractImages && options.saveImageBuffer && row.imageData) {
			const imageData = row.imageData as Uint8Array;
			if (imageData && item.filePath) {
				await options.saveImageBuffer(item.filePath, Buffer.from(imageData));
			}
		}

		items.push(item);
	}

	logger.info({ path: lanceDbDir, count: items.length }, "LanceDB dump read");
	return items;
}

export async function cleanupLanceDBDir(dir: string): Promise<void> {
	await fs.rm(dir, { recursive: true, force: true });
}
