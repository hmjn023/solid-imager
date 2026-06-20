import fs from "node:fs/promises";
import path from "node:path";
import {
	type MediaDumpItem,
	mediaDumpItemSchema,
} from "@solid-imager/core/domain/media/schemas";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import { getErrorMessage } from "@solid-imager/core/utils/get-error-message";
import type { Table } from "drizzle-orm";
import { and, asc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "~/infrastructure/db";
import {
	authors,
	characterIps,
	characters,
	ips,
	lanceDbSyncDirty,
	mediaAuthors,
	mediaCharacters,
	mediaGenerationInfo,
	mediaIps,
	mediaProjects,
	mediaSources,
	medias,
	mediaTags,
	mediaUrls,
	projects,
	tags,
} from "~/infrastructure/db/schema";
import { logger } from "~/infrastructure/logger";
import { getDriver } from "~/infrastructure/storage/factory";
import { nodeStreamToWebReadable } from "~/infrastructure/utils/stream-utils";

interface ArchiverModule {
	TarArchive: new (opts?: object) => import("archiver").Archiver;
}

async function importArchiverModule(): Promise<ArchiverModule> {
	return import("archiver");
}

function _createZipArchive(mod: {
	ZipArchive: new (opts?: object) => import("archiver").Archiver;
}): import("archiver").Archiver {
	return new mod.ZipArchive({ zlib: { level: 9 } });
}

type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

const LanceDbDirtyMaxAttempts = 5;

interface MediaListQueryItem {
	id: string;
	filePath: string;
	fileName: string;
	description: string | null;
	width: number | null;
	height: number | null;
	fileSize: number | null;
	mediaType: string;
	createdAt: Date | string;
	modifiedAt: Date | string;
	generationInfo?: {
		prompt: string | null;
		negativePrompt: string | null;
		modelName: string | null;
		seed: number | null;
		steps: number | null;
		cfgScale: number | null;
		aiGenerated: boolean | null;
		workflow: unknown;
		metadata: unknown;
	} | null;
	urls: { url: string }[];
	tags: {
		tag: { name: string };
		tagType: string;
		confidence: number | null;
		source: string;
	}[];
	authors: {
		author: { name: string; accountId: string | null };
	}[];
	characters: {
		character: {
			name: string;
			description: string | null;
			ips?: { ip: { name: string } }[] | null;
		};
		confidence: number | null;
		source: string;
	}[];
	ips: {
		ip: { name: string; description: string | null };
		confidence: number | null;
		source: string;
	}[];
	projects: {
		project: { name: string; description: string | null };
	}[];
}

type BackupDbClient = Pick<
	typeof db,
	"delete" | "insert" | "query" | "select" | "update"
>;

// const _IMAGES_PREFIX = /^images\//;

/**
 * Validates that a path is relative and does not contain traversal segments.
 */
function validateRelativePath(p: string): void {
	if (!p) {
		return;
	}
	const normalized = path.normalize(p);
	// Check for absolute paths (start with /) or traversal (..)
	// Note: path.isAbsolute check depends on OS, but we want to block starting with / anywhere basically for backups
	if (path.isAbsolute(p) || p.startsWith("/") || normalized.includes("..")) {
		throw new Error(`Invalid path in backup: ${p}`);
	}
}

function validateArchiveEntries(entries: string[]): void {
	for (const entry of entries) {
		validateRelativePath(entry);
	}
}

/**
 * Service for handling media source backups, restoration, and imports.
 */
export const BackupService = {
	/**
	 * Finds a local media source that contains the given relative file path.
	 * Used for determining if an import item should be restored or downloaded.
	 */
	async findMediaSourceForFile(filePath: string): Promise<string | null> {
		try {
			validateRelativePath(filePath);
		} catch {
			return null;
		}

		const localSources = await db.query.mediaSources.findMany({
			where: eq(mediaSources.type, "local"),
		});

		for (const source of localSources) {
			const parsed = localConnectionSchema.safeParse(source.connectionInfo);
			if (!parsed.success) {
				continue;
			}
			const fullPath = path.join(parsed.data.path, filePath);

			try {
				await fs.access(fullPath);
				return source.id;
			} catch {
				// File does not exist in this source, continue
			}
		}

		return null;
	},

	// ... (restoreSource)

	/**
	 * Restores media metadata from a JSON dump.
	 * Optimized with Bulk Operations.
	 */
	async restoreSource(mediaSourceId: string, items: unknown[]) {
		const mediaSource = await db.query.mediaSources.findFirst({
			where: eq(mediaSources.id, mediaSourceId),
		});

		if (!mediaSource) {
			throw new Error("Media source not found");
		}

		// Cast items to MediaDumpItem[] essentially, but validation happens inside filter
		const { validItems, skippedCount, errorMessages } =
			await this._filterValidItems(items, mediaSource);

		if (validItems.length === 0) {
			return {
				processed: 0,
				skipped: skippedCount,
				errors: errorMessages,
			};
		}

		// Execute all data operations atomically
		let mediaPathToId = new Map<string, string>();

		await db.transaction(async (tx) => {
			const c: BackupDbClient = tx;
			const { tagMap, authorMap, projectMap, ipMap, charMap } =
				await this._restoreMasterData(validItems, c);

			await this._restoreMediaRecords(mediaSourceId, validItems, c);

			mediaPathToId = await this._mapMediaPathsToIds(
				mediaSourceId,
				validItems,
				c,
			);

			await this._restoreRelations(
				{
					validItems,
					mediaPathToId,
					tagMap,
					authorMap,
					projectMap,
					ipMap,
					charMap,
				},
				c,
			);
		});

		// Trigger thumbnail generation (skip metadata extraction to preserve restored data)
		if (mediaSource.type === "local") {
			const mediaIds = Array.from(mediaPathToId.values());

			if (mediaIds.length > 0) {
				try {
					const { services } = await import("~/application/registry");
					const jobRepo = services.getJobRepository();

					const connectionInfo = mediaSource.connectionInfo as { path: string };
					const basePath = connectionInfo.path;

					for (const id of mediaIds) {
						await jobRepo.create({
							type: "processMedia",
							mediaSourceId,
							payload: {
								mediaId: id,
								sourcePath: basePath,
								type: "processMedia", // optional
								skipMetadataExtraction: true,
							},
						});
					}
					// Worker handles it automatically
				} catch (e) {
					logger.warn(
						{ err: e },
						"Failed to queue thumbnail generation jobs after restore (non-critical)",
					);
				}
			}
		}

		return {
			processed: validItems.length,
			skipped: skippedCount,
			errors: errorMessages,
		};
	},

	async _filterValidItems(
		items: unknown[],
		mediaSource: { type: string; connectionInfo: unknown },
	) {
		const parsedConnection = localConnectionSchema.safeParse(
			mediaSource.connectionInfo,
		);
		const basePath = parsedConnection.success ? parsedConnection.data.path : "";
		const isLocal = mediaSource.type === "local";

		const validItems: MediaDumpItem[] = [];
		const errorMessages: string[] = [];
		let skippedCount = 0;

		for (const item of items) {
			// Zod Validation
			const result = mediaDumpItemSchema.safeParse(item);
			if (!result.success) {
				skippedCount++;
				errorMessages.push(`Validation failed: ${result.error.message}`);
				continue;
			}

			const validItem = result.data;

			// Ensure filePath and fileName
			if (!(validItem.filePath && validItem.fileName)) {
				skippedCount++;
				continue;
			}

			try {
				validateRelativePath(validItem.filePath);
			} catch (e) {
				skippedCount++;
				errorMessages.push(getErrorMessage(e));
				continue;
			}

			if (isLocal && basePath) {
				const fullPath = path.join(basePath, validItem.filePath);
				try {
					await fs.access(fullPath);
				} catch {
					skippedCount++;
					continue;
				}
			}
			validItems.push(validItem);
		}
		return { validItems, skippedCount, errorMessages };
	},

	async _restoreMasterData(validItems: MediaDumpItem[], _tx?: BackupDbClient) {
		const tagNames = new Set<string>();
		const authorData = new Map<string, { accountId?: string | null }>();
		const projectNames = new Set<string>();
		const charNames = new Set<string>();
		const ipNames = new Set<string>();

		for (const item of validItems) {
			if (item.tags) {
				for (const t of item.tags) {
					if (t.name) {
						tagNames.add(t.name);
					}
				}
			}
			if (item.authors) {
				for (const a of item.authors) {
					// Preserve accountId if available
					if (a.name && (!authorData.has(a.name) || a.accountId)) {
						authorData.set(a.name, { accountId: a.accountId });
					}
				}
			}
			if (item.projects) {
				for (const p of item.projects) {
					if (p.name) {
						projectNames.add(p.name);
					}
				}
			}
			if (item.characters) {
				for (const c of item.characters) {
					if (c.name) {
						charNames.add(c.name);
					}
					if (c.linkedIps && Array.isArray(c.linkedIps)) {
						for (const ipName of c.linkedIps) {
							if (ipName) {
								ipNames.add(ipName);
							}
						}
					}
				}
			}
			if (item.ips) {
				for (const i of item.ips) {
					if (i.name) {
						ipNames.add(i.name);
					}
				}
			}
		}

		const tagMap = await this._ensureMasterData(
			tags,
			tags.id,
			tags.name,
			tagNames,
			{
				source: "restored",
			},
			_tx,
		);
		const authorMap = await this._ensureMasterDataWithExtras(
			authors,
			authors.id,
			authors.name,
			authors.accountId,
			authorData,
			_tx,
		);
		const projectMap = await this._ensureMasterData(
			projects,
			projects.id,
			projects.name,
			projectNames,
			{ description: "" },
			_tx,
		);
		const ipMap = await this._ensureMasterData(
			ips,
			ips.id,
			ips.name,
			ipNames,
			{
				description: "",
				source: "restored",
			},
			_tx,
		);
		const charMap = await this._ensureMasterData(
			characters,
			characters.id,
			characters.name,
			charNames,
			{ description: "", source: "restored" },
			_tx,
		);

		return { tagMap, authorMap, projectMap, ipMap, charMap };
	},

	async _restoreMediaRecords(
		mediaSourceId: string,
		validItems: MediaDumpItem[],
		_tx?: BackupDbClient,
	) {
		const d = _tx ?? db;
		const mediaValues = validItems.map((item) => ({
			mediaSourceId,
			filePath: item.filePath ?? "",
			fileName: item.fileName ?? "",
			description: item.description || null,
			width: item.width ?? 0,
			height: item.height ?? 0,
			fileSize: item.fileSize || 0,
			mediaType: (item.mediaType === "image" || item.mediaType === "video"
				? item.mediaType
				: "image") as "image" | "video",
			createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
			modifiedAt: item.modifiedAt ? new Date(item.modifiedAt) : new Date(),
			indexedAt: new Date(),
			status: "active" as const,
		}));

		// Batch insert is limited by parameter count, so we might need chunking if validItems is huge
		// Assuming reasonable size or caller handles chunking. For safety, let's chunk.
		const ChunkSize = 1000;
		for (let i = 0; i < mediaValues.length; i += ChunkSize) {
			const chunk = mediaValues.slice(i, i + ChunkSize);
			await d
				.insert(medias)
				.values(chunk)
				.onConflictDoUpdate({
					target: [medias.mediaSourceId, medias.filePath],
					set: {
						description: sql`excluded.description`,
						modifiedAt: sql`excluded.modified_at`,
						createdAt: sql`excluded.created_at`,
						width: sql`excluded.width`,
						height: sql`excluded.height`,
						fileSize: sql`excluded.file_size`,
					},
				});
		}
	},

	async _mapMediaPathsToIds(
		mediaSourceId: string,
		validItems: MediaDumpItem[],
		_tx?: BackupDbClient,
	) {
		const d = _tx ?? db;
		const ChunkSize = 1_000;
		const storedMedias: { id: string; filePath: string }[] = [];

		for (let i = 0; i < validItems.length; i += ChunkSize) {
			const chunk = validItems.slice(i, i + ChunkSize);
			const filePaths = chunk.flatMap((item) =>
				item.filePath ? [item.filePath] : [],
			);

			if (filePaths.length === 0) {
				continue;
			}

			const chunkResults = await d.query.medias.findMany({
				where: and(
					eq(medias.mediaSourceId, mediaSourceId),
					inArray(medias.filePath, filePaths),
				),
				columns: { id: true, filePath: true },
			});
			storedMedias.push(...chunkResults);
		}

		if (validItems.length > 0 && storedMedias.length === 0) {
			logger.warn(
				{ mediaSourceId, validItemCount: validItems.length },
				"_mapMediaPathsToIds returned no results — relations will be skipped",
			);
		}

		return new Map(storedMedias.map((m) => [m.filePath, m.id]));
	},

	async _restoreRelations(
		{
			validItems,
			mediaPathToId,
			tagMap,
			authorMap,
			projectMap,
			ipMap,
			charMap,
		}: {
			validItems: MediaDumpItem[];
			mediaPathToId: Map<string, string>;
			tagMap: Map<string, string>;
			authorMap: Map<string, string>;
			projectMap: Map<string, string>;
			ipMap: Map<string, string>;
			charMap: Map<string, string>;
		},
		_tx?: BackupDbClient,
	) {
		const d = _tx ?? db;
		const mediaTagsData: (typeof mediaTags.$inferInsert)[] = [];
		const mediaAuthorsData: (typeof mediaAuthors.$inferInsert)[] = [];
		const mediaProjectsData: (typeof mediaProjects.$inferInsert)[] = [];
		const mediaCharsData: (typeof mediaCharacters.$inferInsert)[] = [];
		const characterIpsData: (typeof characterIps.$inferInsert)[] = [];
		const mediaIpsData: (typeof mediaIps.$inferInsert)[] = [];
		const mediaUrlsData: (typeof mediaUrls.$inferInsert)[] = [];
		const mediaGenInfoData: (typeof mediaGenerationInfo.$inferInsert)[] = [];
		// Track unique (mediaId, ipId) pairs to prevent duplicates
		const seenMediaIps = new Set<string>();

		for (const item of validItems) {
			if (!item.filePath) {
				continue;
			}
			const mediaId = mediaPathToId.get(item.filePath);
			if (!mediaId) {
				continue;
			}

			if (item.tags) {
				for (const t of item.tags) {
					const tagId = t.name ? tagMap.get(t.name) : undefined;
					if (tagId) {
						mediaTagsData.push({
							mediaId,
							tagId,
							tagType: (t.type === "positive" || t.type === "negative"
								? t.type
								: "positive") as "positive" | "negative",
							confidence: t.confidence ?? null,
							source: t.source || "restored",
						});
					}
				}
			}

			if (item.authors) {
				for (const a of item.authors) {
					const authorId = a.name ? authorMap.get(a.name) : undefined;
					if (authorId) {
						mediaAuthorsData.push({ mediaId, authorId });
					}
				}
			}

			if (item.projects) {
				for (const p of item.projects) {
					const projectId = p.name ? projectMap.get(p.name) : undefined;
					if (projectId) {
						mediaProjectsData.push({ mediaId, projectId });
					}
				}
			}

			if (item.ips) {
				for (const i of item.ips) {
					const ipId = i.name ? ipMap.get(i.name) : undefined;
					if (ipId) {
						const key = `${mediaId}:${ipId}`;
						if (!seenMediaIps.has(key)) {
							mediaIpsData.push({
								mediaId,
								ipId,
								confidence: i.confidence ?? null,
								source: i.source || "restored",
							});
							seenMediaIps.add(key);
						}
					}
				}
			}

			// Collect media IP names for character-IP inference
			const mediaIpNames = item.ips?.map((i) => i.name).filter(Boolean) || [];

			if (item.characters) {
				for (const c of item.characters) {
					const charId = c.name ? charMap.get(c.name) : undefined;
					if (charId) {
						mediaCharsData.push({
							mediaId,
							characterId: charId,
							confidence: c.confidence ?? null,
							source: c.source || "restored",
						});

						// Determine which IPs to link to this character
						// Priority: 1) linkedIps from JSON, 2) infer from media's IPs
						const ipNamesToLink =
							c.linkedIps &&
							Array.isArray(c.linkedIps) &&
							c.linkedIps.length > 0
								? c.linkedIps
								: mediaIpNames;

						for (const ipName of ipNamesToLink) {
							const ipId = ipName ? ipMap.get(ipName) : undefined;
							if (ipId) {
								characterIpsData.push({
									characterId: charId,
									ipId,
									source: "restored",
								});

								// Also ensure this IP is linked to the media (prevent duplicates)
								const key = `${mediaId}:${ipId}`;
								if (!seenMediaIps.has(key)) {
									mediaIpsData.push({
										mediaId,
										ipId,
										confidence: c.confidence ?? null, // Use character's confidence as fallback
										source: "character_link",
									});
									seenMediaIps.add(key);
								}
							}
						}
					}
				}
			}

			if (item.sourceUrls) {
				for (const url of item.sourceUrls) {
					mediaUrlsData.push({ mediaId, url });
				}
			}

			if (item.generationInfo) {
				const info = item.generationInfo;
				mediaGenInfoData.push({
					mediaId,
					...info,
				});
			}
		}

		const mediaIds = Array.from(mediaPathToId.values());

		// Delete existing relations in chunks to avoid PGlite parameter limits
		if (mediaIds.length > 0) {
			const DeleteChunkSize = 1_000;
			for (let i = 0; i < mediaIds.length; i += DeleteChunkSize) {
				const chunk = mediaIds.slice(i, i + DeleteChunkSize);
				await d.delete(mediaTags).where(inArray(mediaTags.mediaId, chunk));
				await d
					.delete(mediaAuthors)
					.where(inArray(mediaAuthors.mediaId, chunk));
				await d
					.delete(mediaProjects)
					.where(inArray(mediaProjects.mediaId, chunk));
				await d
					.delete(mediaCharacters)
					.where(inArray(mediaCharacters.mediaId, chunk));
				await d.delete(mediaIps).where(inArray(mediaIps.mediaId, chunk));
				await d.delete(mediaUrls).where(inArray(mediaUrls.mediaId, chunk));
				await d
					.delete(mediaGenerationInfo)
					.where(inArray(mediaGenerationInfo.mediaId, chunk));
			}
		}

		// Insert new relations in chunks
		const insertChunked = async <T>(table: Table, data: T[]) => {
			const BatchSize = 1_000;
			for (let i = 0; i < data.length; i += BatchSize) {
				await d
					.insert(table)
					.values(data.slice(i, i + BatchSize))
					.onConflictDoNothing();
			}
		};

		if (mediaTagsData.length) {
			await insertChunked(mediaTags, mediaTagsData);
		}
		if (mediaAuthorsData.length) {
			await insertChunked(mediaAuthors, mediaAuthorsData);
		}
		if (mediaProjectsData.length) {
			await insertChunked(mediaProjects, mediaProjectsData);
		}
		if (mediaCharsData.length) {
			await insertChunked(mediaCharacters, mediaCharsData);
		}
		if (characterIpsData.length) {
			await insertChunked(characterIps, characterIpsData);
		}
		if (mediaIpsData.length) {
			await insertChunked(mediaIps, mediaIpsData);
		}
		if (mediaUrlsData.length) {
			await insertChunked(mediaUrls, mediaUrlsData);
		}
		if (mediaGenInfoData.length) {
			await insertChunked(mediaGenerationInfo, mediaGenInfoData);
		}
	},

	async _ensureMasterData(
		table: Table,
		idColumn: PgColumn,
		nameColumn: PgColumn,
		names: Set<string>,
		defaults: Record<string, JsonValue>,
		_tx?: BackupDbClient,
	): Promise<Map<string, string>> {
		const d = _tx ?? db;
		const nameList = Array.from(names);
		if (nameList.length === 0) {
			return new Map();
		}

		// Bulk Insert
		await d
			.insert(table)
			.values(nameList.map((name) => ({ name, ...defaults })))
			.onConflictDoNothing();

		// Fetch IDs
		const records = (await d
			.select({ id: idColumn, name: nameColumn })
			.from(table)
			.where(inArray(nameColumn, nameList))) as { id: string; name: string }[];

		return new Map(records.map((r) => [r.name, r.id]));
	},

	/**
	 * Ensures master data with extra fields (specifically for authors with accountId).
	 * Authors table has no unique constraint on name (display names can overlap),
	 * so we use manual dedup by name and update accountId when available.
	 */
	async _ensureMasterDataWithExtras(
		table: Table,
		idColumn: PgColumn,
		nameColumn: PgColumn,
		accountIdColumn: PgColumn,
		dataMap: Map<string, { accountId?: string | null }>,
		_tx?: BackupDbClient,
	): Promise<Map<string, string>> {
		const d = _tx ?? db;
		if (dataMap.size === 0) {
			return new Map();
		}

		const entries = Array.from(dataMap.entries());
		const nameList = entries.map(([name]) => name);

		// First, find existing authors by name
		const existingRecords = (await d
			.select({
				id: idColumn,
				name: nameColumn,
				accountId: accountIdColumn,
			})
			.from(table)
			.where(inArray(nameColumn, nameList))) as {
			id: string;
			name: string;
			accountId: string | null;
		}[];

		const existingByName = new Map<
			string,
			{ id: string; accountId: string | null }
		>();
		for (const r of existingRecords) {
			const existing = existingByName.get(r.name);
			// Prioritize entry with an accountId, or just take the first one if none have it yet.
			if (!existing || (!existing.accountId && r.accountId)) {
				existingByName.set(r.name, { id: r.id, accountId: r.accountId });
			}
		}

		// Update existing authors with new accountId if provided
		// Note: Update ALL authors with matching name (handles duplicates)
		for (const [name, data] of entries) {
			const existing = existingByName.get(name);
			if (existing && data.accountId && existing.accountId !== data.accountId) {
				await d
					.update(table)
					.set({ accountId: data.accountId })
					.where(eq(nameColumn, name));
			}
		}

		// Insert new authors that don't exist
		const newEntries = entries.filter(([name]) => !existingByName.has(name));
		if (newEntries.length > 0) {
			await d.insert(table).values(
				newEntries.map(([name, data]) => ({
					name,
					accountId: data.accountId || null,
				})),
			);

			// Fetch the newly inserted records
			const newRecords = (await d
				.select({
					id: idColumn,
					name: nameColumn,
					accountId: accountIdColumn,
				})
				.from(table)
				.where(
					inArray(
						nameColumn,
						newEntries.map(([name]) => name),
					),
				)) as { id: string; name: string; accountId: string | null }[];

			for (const r of newRecords) {
				if (!existingByName.has(r.name)) {
					existingByName.set(r.name, { id: r.id, accountId: r.accountId });
				}
			}
		}

		// Return map of name -> id
		return new Map(
			Array.from(existingByName.entries()).map(([name, data]) => [
				name,
				data.id,
			]),
		);
	},

	/**
	 * Imports media data from a ZIP file path.
	 */
	async importSourceNdjson(mediaSourceId: string, ndjsonFilePath: string) {
		const readline = await import("node:readline");
		const fsSync = await import("node:fs");

		if (!fsSync.existsSync(ndjsonFilePath)) {
			return {
				importedCount: 0,
				skippedCount: 0,
				errors: ["dump.ndjson not found"],
			};
		}

		const fileStream = fsSync.createReadStream(ndjsonFilePath);
		const rl = readline.createInterface({
			input: fileStream,
			crlfDelay: Infinity,
		});

		let batch: unknown[] = [];
		let totalProcessed = 0;
		let totalSkipped = 0;
		const allErrors: string[] = [];

		const flushBatch = async () => {
			if (batch.length === 0) return;
			const result = await this.restoreSource(mediaSourceId, batch);
			totalProcessed += result.processed;
			totalSkipped += result.skipped;
			allErrors.push(...result.errors);
			batch = [];
		};

		for await (const line of rl) {
			if (!line.trim()) continue;
			try {
				const item = JSON.parse(line);
				batch.push(item);
				if (batch.length >= 2000) {
					await flushBatch();
				}
			} catch (e) {
				allErrors.push(`Failed to parse line: ${getErrorMessage(e)}`);
			}
		}
		await flushBatch();

		return {
			importedCount: totalProcessed,
			skippedCount: totalSkipped,
			errors: allErrors,
		};
	},

	async importSourceTar(mediaSourceId: string, tarFilePath: string) {
		const mediaSource = await db.query.mediaSources.findFirst({
			where: eq(mediaSources.id, mediaSourceId),
		});

		if (!mediaSource) {
			throw new Error("Media source not found");
		}

		const { execSync } = await import("node:child_process");
		const pathMod = await import("node:path");

		const extractDir = pathMod.join(
			process.cwd(),
			".cache",
			"import-restore",
			`restore-${Date.now()}`,
		);
		await fs.mkdir(extractDir, { recursive: true });

		try {
			const listOutput = execSync(`tar -tf "${tarFilePath}"`, {
				encoding: "utf-8",
			});
			validateArchiveEntries(listOutput.split("\n").filter(Boolean));

			// Extract tar (without compression options)
			execSync(
				`tar -xf "${tarFilePath}" -C "${extractDir}" --no-same-owner --no-same-permissions`,
				{
					stdio: "ignore",
				},
			);

			// 1. Import Images
			const driver = getDriver(mediaSource);
			const imagesDir = pathMod.join(extractDir, "images");

			const restoreImagesRecursive = async (
				dir: string,
				currentRelative: string = "",
			) => {
				let files: Array<string> = [];
				try {
					files = await fs.readdir(dir);
				} catch {
					return; // images folder does not exist or empty
				}

				await Promise.all(
					files.map(async (file) => {
						const fullPath = pathMod.join(dir, file);
						const relPath = currentRelative
							? pathMod.join(currentRelative, file)
							: file;
						const stat = await fs.stat(fullPath);
						if (stat.isDirectory()) {
							await restoreImagesRecursive(fullPath, relPath);
						} else {
							const buf = await fs.readFile(fullPath);
							await driver.put(relPath, buf);
						}
					}),
				);
			};

			await restoreImagesRecursive(imagesDir);

			// 2. Import Metadata
			const ndjsonPath = pathMod.join(extractDir, "dump.ndjson");
			const restoreResult = await this.importSourceNdjson(
				mediaSourceId,
				ndjsonPath,
			);

			return {
				success: true,
				importedCount: restoreResult.importedCount,
				skippedCount: restoreResult.skippedCount,
				errors: restoreResult.errors,
				message: `Successfully imported ${restoreResult.importedCount} items (Skipped: ${restoreResult.skippedCount})`,
			};
		} finally {
			await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
		}
	},

	async importLanceDB(
		mediaSourceId: string,
		tarPath: string,
		options?: { extractImages?: boolean },
	) {
		const mediaSource = await db.query.mediaSources.findFirst({
			where: eq(mediaSources.id, mediaSourceId),
		});

		if (!mediaSource) {
			throw new Error("Media source not found");
		}

		const { readFromLanceDB, cleanupLanceDBDir } = await import(
			"~/application/services/lancedb-dump-service"
		);
		const { execSync } = await import("node:child_process");
		const pathMod = await import("node:path");

		const extractDir = pathMod.join(
			process.cwd(),
			".cache",
			"lancedb-restore",
			`restore-${Date.now()}`,
		);
		await fs.mkdir(extractDir, { recursive: true });

		const extractImages = options?.extractImages ?? true;

		try {
			const listOutput = execSync(`tar -tf "${tarPath}"`, {
				encoding: "utf-8",
			});
			const entries = listOutput.split("\n").filter(Boolean);
			for (const entry of entries) {
				const normalized = pathMod.normalize(entry);
				if (
					pathMod.isAbsolute(entry) ||
					entry.startsWith("/") ||
					normalized.includes("..")
				) {
					throw new Error(
						`Invalid path in archive: ${entry}. Path traversal detected.`,
					);
				}
			}

			execSync(
				`tar -xf "${tarPath}" -C "${extractDir}" --no-same-owner --no-same-permissions`,
				{
					stdio: "ignore",
				},
			);

			const driver = getDriver(mediaSource);

			let totalProcessed = 0;
			let totalSkipped = 0;
			const allErrors: string[] = [];

			// Process each chunk: restore metadata first, then images
			// This prevents race condition with file watcher
			await readFromLanceDB(extractDir, {
				extractImages,
				saveImageBuffer: extractImages
					? async (filePath: string, buffer: Buffer) => {
							await driver.put(filePath, buffer);
						}
					: undefined,
				onChunk: async (chunk) => {
					const result = await this.restoreSource(mediaSourceId, chunk);
					totalProcessed += result.processed;
					totalSkipped += result.skipped;
					allErrors.push(...result.errors);
				},
			});

			return {
				success: true,
				importedCount: totalProcessed,
				skippedCount: totalSkipped,
				errors: allErrors,
				message: `Successfully imported ${totalProcessed} items (Skipped: ${totalSkipped})`,
			};
		} finally {
			await cleanupLanceDBDir(extractDir);
		}
	},

	async queueSourceLanceDBDelta(
		mediaSourceId: string,
		mediaIds: string[],
		operation: "upsert" | "delete" = "upsert",
		options: { enqueueJob?: boolean } = {},
	) {
		const uniqueMediaIds = [...new Set(mediaIds)].filter(Boolean);
		if (uniqueMediaIds.length === 0) {
			return { queued: 0 };
		}

		const now = new Date();
		const rows = uniqueMediaIds.map((mediaId) => ({
			mediaSourceId,
			mediaId,
			operation,
			updatedAt: now,
		}));

		await db
			.insert(lanceDbSyncDirty)
			.values(rows)
			.onConflictDoUpdate({
				target: [lanceDbSyncDirty.mediaSourceId, lanceDbSyncDirty.mediaId],
				set: {
					operation,
					lastError: null,
					updatedAt: now,
				},
			});

		if (options.enqueueJob !== false) {
			const { services } = await import("~/application/registry");
			await services.getJobRepository().createIfUnique({
				type: "sync_lancedb_delta",
				mediaSourceId,
				payload: { reason: "dirty", batchSize: 500 },
			});
		}

		return { queued: uniqueMediaIds.length };
	},

	async syncSourceLanceDBDeltaCache(mediaSourceId: string, batchSize = 500) {
		const mediaSource = await db.query.mediaSources.findFirst({
			where: eq(mediaSources.id, mediaSourceId),
		});

		if (!mediaSource) {
			throw new Error("Media source not found");
		}

		const { services } = await import("~/application/registry");
		const config = services.getConfigService().getConfig();
		const baseCacheDir = config.lancedb?.cacheDir ?? ".cache/lancedb-cache";
		const cacheDir = path.isAbsolute(baseCacheDir)
			? path.join(baseCacheDir, `source-${mediaSourceId}`)
			: path.join(process.cwd(), baseCacheDir, `source-${mediaSourceId}`);

		const manifestPath = path.join(cacheDir, "manifest.json");
		try {
			const content = await fs.readFile(manifestPath, "utf-8");
			const manifest = JSON.parse(content) as { version?: unknown };
			if (manifest.version !== 3) {
				if (!config.lancedb?.autoFullSync) {
					logger.warn(
						{ mediaSourceId },
						"LanceDB auto full sync is disabled because manifest version is invalid. Skipping auto sync.",
					);
					return { mode: "delta", processed: 0 };
				}
				await this.syncSourceLanceDBCache(mediaSourceId);
				return { mode: "full", processed: 0 };
			}
		} catch {
			if (!config.lancedb?.autoFullSync) {
				logger.warn(
					{ mediaSourceId },
					"LanceDB auto full sync is disabled because manifest.json is missing. Skipping auto sync.",
				);
				return { mode: "delta", processed: 0 };
			}
			await this.syncSourceLanceDBCache(mediaSourceId);
			return { mode: "full", processed: 0 };
		}

		const dirtyRows = await db
			.select()
			.from(lanceDbSyncDirty)
			.where(
				and(
					eq(lanceDbSyncDirty.mediaSourceId, mediaSourceId),
					lt(lanceDbSyncDirty.attempts, LanceDbDirtyMaxAttempts),
				),
			)
			.orderBy(asc(lanceDbSyncDirty.updatedAt))
			.limit(batchSize);

		if (dirtyRows.length === 0) {
			return { mode: "delta", processed: 0 };
		}

		const deleteIds = dirtyRows
			.filter((row) => row.operation === "delete")
			.map((row) => row.mediaId);
		const upsertIds = dirtyRows
			.filter((row) => row.operation !== "delete")
			.map((row) => row.mediaId);

		try {
			let upsertItems: MediaDumpItem[] = [];
			if (upsertIds.length > 0) {
				const mediaList: MediaListQueryItem[] = await db.query.medias.findMany({
					where: and(
						eq(medias.mediaSourceId, mediaSourceId),
						inArray(medias.id, upsertIds),
					),
					with: {
						generationInfo: true,
						urls: true,
						tags: { with: { tag: true } },
						authors: { with: { author: true } },
						characters: {
							with: {
								character: {
									with: { ips: { with: { ip: true } } },
								},
							},
						},
						ips: { with: { ip: true } },
						projects: { with: { project: true } },
					},
				});
				upsertItems = this._transformMediaList(mediaList);
			}

			const { syncLanceDBDelta } = await import(
				"~/application/services/lancedb-dump-service"
			);
			await syncLanceDBDelta(cacheDir, {
				mediaIdsToDelete: [...deleteIds, ...upsertIds],
				itemsToUpsert: upsertItems,
			});

			await db.delete(lanceDbSyncDirty).where(
				inArray(
					lanceDbSyncDirty.id,
					dirtyRows.map((row) => row.id),
				),
			);

			logger.info(
				{
					mediaSourceId,
					processed: dirtyRows.length,
					upserted: upsertItems.length,
					deleted: deleteIds.length,
				},
				"syncSourceLanceDBDeltaCache completed successfully",
			);

			return { mode: "delta", processed: dirtyRows.length };
		} catch (error) {
			const message = getErrorMessage(error);
			await db
				.update(lanceDbSyncDirty)
				.set({
					attempts: sql`${lanceDbSyncDirty.attempts} + 1`,
					lastError: message,
					updatedAt: new Date(),
				})
				.where(
					inArray(
						lanceDbSyncDirty.id,
						dirtyRows.map((row) => row.id),
					),
				);
			throw error;
		}
	},

	/**
	 * Generates a dump of the media source.
	 * Returns a JSON object or a ReadableStream for ZIP download.
	 */
	async syncSourceLanceDBCache(
		mediaSourceId: string,
		options?: { batchSize?: number; delayMs?: number },
	) {
		const mediaSource = await db.query.mediaSources.findFirst({
			where: eq(mediaSources.id, mediaSourceId),
		});

		if (!mediaSource) {
			throw new Error("Media source not found");
		}

		const { services } = await import("~/application/registry");
		const config = services.getConfigService().getConfig();
		const baseCacheDir = config.lancedb?.cacheDir ?? ".cache/lancedb-cache";
		const cacheDir = path.isAbsolute(baseCacheDir)
			? path.join(baseCacheDir, `source-${mediaSourceId}`)
			: path.join(process.cwd(), baseCacheDir, `source-${mediaSourceId}`);
		await fs.mkdir(cacheDir, { recursive: true });

		const { syncLanceDBPages } = await import(
			"~/application/services/lancedb-dump-service"
		);

		const limit = options?.batchSize ?? 1000;
		const delayMs = options?.delayMs ?? 0;
		const self = this;

		async function* loadPages(): AsyncIterable<MediaDumpItem[]> {
			let lastId: string | null = null;

			while (true) {
				const mediaList: MediaListQueryItem[] = await db.query.medias.findMany({
					where: lastId
						? and(
								eq(medias.mediaSourceId, mediaSourceId),
								gt(medias.id, lastId),
							)
						: eq(medias.mediaSourceId, mediaSourceId),
					limit,
					with: {
						generationInfo: true,
						urls: true,
						tags: { with: { tag: true } },
						authors: { with: { author: true } },
						characters: {
							with: { character: { with: { ips: { with: { ip: true } } } } },
						},
						ips: { with: { ip: true } },
						projects: { with: { project: true } },
					},
					orderBy: medias.id,
				});

				if (mediaList.length === 0) {
					break;
				}

				yield self._transformMediaList(mediaList);

				if (mediaList.length < limit) {
					break;
				}
				lastId = mediaList.at(-1)?.id ?? lastId;

				if (delayMs > 0) {
					await new Promise((resolve) => setTimeout(resolve, delayMs));
				}
			}
		}

		const syncedCount = await syncLanceDBPages(cacheDir, loadPages());
		await db
			.delete(lanceDbSyncDirty)
			.where(eq(lanceDbSyncDirty.mediaSourceId, mediaSourceId));

		logger.info(
			{ mediaSourceId, upserted: syncedCount },
			"syncSourceLanceDBCache completed successfully",
		);
	},

	/**
	 * Generates a dump of the media source.
	 * Returns a JSON object or a ReadableStream for ZIP download.
	 */
	async createDump(
		mediaSourceId: string,
		mode: "json" | "zip" | "ndjson" | "tar" | "lancedb" = "ndjson",
		options?: { includeImages: boolean },
	) {
		// 1. Fetch Media Source Info (needed for Driver)
		const mediaSource = await db.query.mediaSources.findFirst({
			where: eq(mediaSources.id, mediaSourceId),
		});

		if (!mediaSource) {
			throw new Error("Media Source not found");
		}

		// Map legacy modes to new modes
		const targetMode =
			mode === "json" ? "ndjson" : mode === "zip" ? "tar" : mode;

		if (targetMode === "ndjson") {
			const { PassThrough } = await import("node:stream");
			const passThrough = new PassThrough();

			(async () => {
				try {
					const limit = 1000;
					let lastId: string | null = null;
					let hasMore = true;

					while (hasMore) {
						const mediaList: MediaListQueryItem[] =
							await db.query.medias.findMany({
								where: lastId
									? and(
											eq(medias.mediaSourceId, mediaSourceId),
											gt(medias.id, lastId),
										)
									: eq(medias.mediaSourceId, mediaSourceId),
								limit,
								with: {
									generationInfo: true,
									urls: true,
									tags: { with: { tag: true } },
									authors: { with: { author: true } },
									characters: {
										with: {
											character: { with: { ips: { with: { ip: true } } } },
										},
									},
									ips: { with: { ip: true } },
									projects: { with: { project: true } },
								},
								orderBy: medias.id,
							});

						if (mediaList.length < limit) {
							hasMore = false;
						}
						lastId = mediaList.at(-1)?.id ?? lastId;

						if (mediaList.length > 0) {
							const transformedItems = this._transformMediaList(mediaList);
							for (const item of transformedItems) {
								passThrough.write(`${JSON.stringify(item)}\n`);
							}
						}
					}
					passThrough.end();
				} catch (err) {
					logger.error({ err }, "Error generating NDJSON dump");
					passThrough.destroy(
						err instanceof Error ? err : new Error(String(err)),
					);
				}
			})();

			return nodeStreamToWebReadable(passThrough);
		}

		if (targetMode === "tar") {
			const driver = getDriver(mediaSource);
			const archiverMod = await importArchiverModule();
			const { PassThrough } = await import("node:stream");

			const passThrough = new PassThrough();
			const ndjsonStream = new PassThrough();
			const archive = new archiverMod.TarArchive();
			archive.pipe(passThrough);
			archive.append(ndjsonStream, { name: "dump.ndjson" });

			(async () => {
				try {
					const limit = 1000;
					let lastId: string | null = null;
					let hasMore = true;

					while (hasMore) {
						const mediaList: MediaListQueryItem[] =
							await db.query.medias.findMany({
								where: lastId
									? and(
											eq(medias.mediaSourceId, mediaSourceId),
											gt(medias.id, lastId),
										)
									: eq(medias.mediaSourceId, mediaSourceId),
								limit,
								with: {
									generationInfo: true,
									urls: true,
									tags: { with: { tag: true } },
									authors: { with: { author: true } },
									characters: {
										with: {
											character: { with: { ips: { with: { ip: true } } } },
										},
									},
									ips: { with: { ip: true } },
									projects: { with: { project: true } },
								},
								orderBy: medias.id,
							});

						if (mediaList.length < limit) {
							hasMore = false;
						}
						lastId = mediaList.at(-1)?.id ?? lastId;

						if (mediaList.length > 0) {
							const transformedItems = this._transformMediaList(mediaList);
							const includeImages = options?.includeImages ?? true;
							for (const item of transformedItems) {
								ndjsonStream.write(`${JSON.stringify(item)}\n`);

								if (includeImages && item.filePath) {
									try {
										const buffer = await driver.get(item.filePath);
										archive.append(buffer, { name: `images/${item.filePath}` });
									} catch {
										// ignore missing files
									}
								}
							}
						}
					}

					ndjsonStream.end();
					await archive.finalize();
				} catch (err) {
					logger.error({ err }, "Error generating TAR dump");
					ndjsonStream.destroy(
						err instanceof Error ? err : new Error(String(err)),
					);
					archive.abort();
				}
			})();

			return nodeStreamToWebReadable(passThrough);
		}

		if (targetMode === "lancedb") {
			const { writeToLanceDB, cleanupLanceDBDir } = await import(
				"~/application/services/lancedb-dump-service"
			);
			const tempBaseDir = path.join(
				process.cwd(),
				".cache",
				"lancedb-dump",
				`source-${mediaSourceId}`,
			);
			const includeImages = options?.includeImages ?? true;
			const dumpedItems: MediaDumpItem[] = [];
			const limit = 1000;
			let lastId: string | null = null;

			while (true) {
				const mediaList: MediaListQueryItem[] = await db.query.medias.findMany({
					where: lastId
						? and(
								eq(medias.mediaSourceId, mediaSourceId),
								gt(medias.id, lastId),
							)
						: eq(medias.mediaSourceId, mediaSourceId),
					limit,
					with: {
						generationInfo: true,
						urls: true,
						tags: { with: { tag: true } },
						authors: { with: { author: true } },
						characters: {
							with: {
								character: { with: { ips: { with: { ip: true } } } },
							},
						},
						ips: { with: { ip: true } },
						projects: { with: { project: true } },
					},
					orderBy: medias.id,
				});

				if (mediaList.length === 0) break;
				dumpedItems.push(...this._transformMediaList(mediaList));
				lastId = mediaList.at(-1)?.id ?? lastId;
				if (mediaList.length < limit) break;
			}

			const lanceDbDir = await writeToLanceDB(dumpedItems, {
				includeImages,
				tempDir: tempBaseDir,
			});
			const driver = getDriver(mediaSource);
			const archiverMod = await importArchiverModule();
			const { PassThrough } = await import("node:stream");

			const passThrough = new PassThrough();
			const archive = new archiverMod.TarArchive();
			archive.pipe(passThrough);

			(async () => {
				try {
					archive.directory(lanceDbDir, false);

					if (includeImages) {
						for (const item of dumpedItems) {
							if (!item.filePath) continue;
							try {
								const buffer = await driver.get(item.filePath);
								archive.append(buffer, { name: `images/${item.filePath}` });
							} catch {
								// ignore missing files
							}
						}
					}

					await archive.finalize();
					await cleanupLanceDBDir(lanceDbDir);
				} catch (err) {
					logger.error(
						{ err },
						"Error generating LanceDB TAR dump with images",
					);
					archive.abort();
					await cleanupLanceDBDir(lanceDbDir).catch(() => {});
				}
			})();

			return nodeStreamToWebReadable(passThrough);
		}
		throw new Error(`Unsupported dump mode: ${mode}`);
	},

	// Helper to transform media list to dump format
	_transformMediaList(
		mediaList: Partial<MediaListQueryItem>[],
	): MediaDumpItem[] {
		return mediaList.map((media) => {
			// Extract tags
			const simpleTags = (media.tags || []).map((mt) => ({
				name: mt.tag?.name || "",
				type:
					mt.tagType === "positive"
						? ("positive" as const)
						: mt.tagType === "negative"
							? ("negative" as const)
							: undefined,
				confidence: mt.confidence ?? null,
				source: mt.source || "",
			}));

			// Extract authors
			const simpleAuthors = (media.authors || []).map((ma) => ({
				name: ma.author?.name || "",
				accountId: ma.author?.accountId ?? null,
			}));

			// Extract characters
			const simpleCharacters = (media.characters || []).map((mc) => ({
				name: mc.character?.name || "",
				description: mc.character?.description ?? null,
				confidence: mc.confidence ?? null,
				linkedIps:
					mc.character?.ips?.map((ci) => ci.ip?.name || "").filter(Boolean) ??
					[],
				source: mc.source || "",
			}));

			// Extract IPs
			const simpleIps = (media.ips || []).map((mi) => ({
				name: mi.ip?.name || "",
				description: mi.ip?.description ?? null,
				confidence: mi.confidence ?? null,
				source: mi.source || "",
			}));

			// Extract Projects
			const simpleProjects = (media.projects || []).map((mp) => ({
				name: mp.project?.name || "",
				description: mp.project?.description ?? null,
			}));

			// Extract source URLs
			const sourceUrls = (media.urls || [])
				.map((u) => u.url || "")
				.filter(Boolean);

			return {
				id: media.id,
				filePath: media.filePath,
				fileName: media.fileName,
				description: media.description ?? undefined,
				width: media.width ?? undefined,
				height: media.height ?? undefined,
				fileSize: media.fileSize ?? undefined,
				mediaType:
					media.mediaType === "image" ||
					media.mediaType === "video" ||
					media.mediaType === "audio"
						? media.mediaType
						: undefined,
				createdAt: media.createdAt ? new Date(media.createdAt) : undefined,
				modifiedAt: media.modifiedAt ? new Date(media.modifiedAt) : undefined,
				// indexedAt: media.indexedAt, // Not in schema

				// Essential metadata
				sourceUrls,

				// AI Generation Info
				generationInfo: media.generationInfo
					? {
							prompt: media.generationInfo.prompt ?? undefined,
							negativePrompt: media.generationInfo.negativePrompt ?? undefined,
							modelName: media.generationInfo.modelName || undefined,
							seed: media.generationInfo.seed ?? undefined,
							steps: media.generationInfo.steps ?? undefined,
							cfgScale: media.generationInfo.cfgScale ?? undefined,
							aiGenerated: media.generationInfo.aiGenerated ?? undefined,
							workflow: media.generationInfo.workflow ?? undefined,
							metadata: media.generationInfo.metadata ?? undefined,
						}
					: null,

				tags: simpleTags,
				authors: simpleAuthors,
				characters: simpleCharacters,
				ips: simpleIps,
				projects: simpleProjects,
			};
		});
	},
};
