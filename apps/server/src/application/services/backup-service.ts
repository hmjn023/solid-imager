import fs from "node:fs/promises";
import path from "node:path";
import { type MediaDumpItem, mediaDumpItemSchema } from "@solid-imager/core/domain/media/schemas";
import { and, eq, inArray, sql } from "drizzle-orm";
import yauzl from "yauzl";
import { db } from "~/infrastructure/db";
import {
	authors,
	characterIps,
	characters,
	ips,
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
			const connectionInfo = source.connectionInfo as { path: string };
			const basePath = connectionInfo.path;
			const fullPath = path.join(basePath, filePath);

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
	async restoreSource(mediaSourceId: string, items: any[]) {
		const mediaSource = await db.query.mediaSources.findFirst({
			where: eq(mediaSources.id, mediaSourceId),
		});

		if (!mediaSource) {
			throw new Error("Media source not found");
		}

		// Cast items to MediaDumpItem[] essentially, but validation happens inside filter
		const { validItems, skippedCount, errorMessages } = await this._filterValidItems(
			items,
			mediaSource,
		);

		if (validItems.length === 0) {
			return {
				processed: 0,
				skipped: skippedCount,
				errors: errorMessages,
			};
		}

		// Master Data Handling
		const { tagMap, authorMap, projectMap, ipMap, charMap } =
			await this._restoreMasterData(validItems);

		// Media Handling
		await this._restoreMediaRecords(mediaSourceId, validItems);

		const mediaPathToId = await this._mapMediaPathsToIds(mediaSourceId, validItems);

		// Relations Handling
		await this._restoreRelations({
			validItems,
			mediaPathToId,
			tagMap,
			authorMap,
			projectMap,
			ipMap,
			charMap,
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

	async _filterValidItems(items: any[], mediaSource: any) {
		const connectionInfo = mediaSource.connectionInfo as { path: string };
		const basePath = connectionInfo.path;
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
				errorMessages.push((e as Error).message);
				continue;
			}

			if (isLocal) {
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

	async _restoreMasterData(validItems: MediaDumpItem[]) {
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

		const tagMap = await this._ensureMasterData(tags, tags.name, tagNames, {
			source: "restored",
		});
		const authorMap = await this._ensureMasterDataWithExtras(authors, authors.name, authorData);
		const projectMap = await this._ensureMasterData(projects, projects.name, projectNames, {
			description: "",
		});
		const ipMap = await this._ensureMasterData(ips, ips.name, ipNames, {
			description: "",
			source: "restored",
		});
		const charMap = await this._ensureMasterData(characters, characters.name, charNames, {
			description: "",
			source: "restored",
		});

		return { tagMap, authorMap, projectMap, ipMap, charMap };
	},

	async _restoreMediaRecords(mediaSourceId: string, validItems: MediaDumpItem[]) {
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
			await db
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

	async _mapMediaPathsToIds(mediaSourceId: string, validItems: MediaDumpItem[]) {
		// Parameter limit avoidance: Split validItems into chunks
		const ChunkSize = 10_000;
		const storedMedias: { id: string; filePath: string }[] = [];

		for (let i = 0; i < validItems.length; i += ChunkSize) {
			const chunk = validItems.slice(i, i + ChunkSize);
			// We need to filter out items with undefined filePath (though filtered before)
			const filePaths = chunk.map((item) => item.filePath).filter((p): p is string => !!p);

			if (filePaths.length === 0) {
				continue;
			}

			const chunkResults = await db.query.medias.findMany({
				where: and(eq(medias.mediaSourceId, mediaSourceId), inArray(medias.filePath, filePaths)),
				columns: { id: true, filePath: true },
			});
			storedMedias.push(...chunkResults);
		}

		return new Map(storedMedias.map((m) => [m.filePath, m.id]));
	},

	async _restoreRelations({
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
	}) {
		const mediaTagsData: any[] = [];
		const mediaAuthorsData: any[] = [];
		const mediaProjectsData: any[] = [];
		const mediaCharsData: any[] = [];
		const characterIpsData: any[] = [];
		const mediaIpsData: any[] = [];
		// Track unique (mediaId, ipId) pairs to prevent duplicates
		const seenMediaIps = new Set<string>();
		// ... rest of data arrays
		const mediaUrlsData: any[] = [];
		const mediaGenInfoData: any[] = [];

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
							tagType: (t.type === "positive" || t.type === "negative" ? t.type : "positive") as
								| "positive"
								| "negative",
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
							c.linkedIps && Array.isArray(c.linkedIps) && c.linkedIps.length > 0
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
		if (mediaIds.length > 0) {
			await db.delete(mediaTags).where(inArray(mediaTags.mediaId, mediaIds));
			await db.delete(mediaAuthors).where(inArray(mediaAuthors.mediaId, mediaIds));
			await db.delete(mediaProjects).where(inArray(mediaProjects.mediaId, mediaIds));
			await db.delete(mediaCharacters).where(inArray(mediaCharacters.mediaId, mediaIds));
			await db.delete(mediaIps).where(inArray(mediaIps.mediaId, mediaIds));
			await db.delete(mediaUrls).where(inArray(mediaUrls.mediaId, mediaIds));
			await db.delete(mediaGenerationInfo).where(inArray(mediaGenerationInfo.mediaId, mediaIds));
		}

		const insertChunked = async (table: any, data: any[]) => {
			const BatchSize = 1000;
			for (let i = 0; i < data.length; i += BatchSize) {
				await db
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
		table: any,
		nameColumn: any,
		names: Set<string>,
		defaults: any,
	): Promise<Map<string, string>> {
		const nameList = Array.from(names);
		if (nameList.length === 0) {
			return new Map();
		}

		// Bulk Insert
		await db
			.insert(table)
			.values(nameList.map((name) => ({ name, ...defaults })))
			.onConflictDoNothing();

		// Fetch IDs
		const records = await db
			.select({ id: table.id, name: nameColumn })
			.from(table)
			.where(inArray(nameColumn, nameList));

		return new Map(records.map((r: any) => [r.name, r.id]));
	},

	/**
	 * Ensures master data with extra fields (specifically for authors with accountId).
	 * Authors table does NOT have unique constraint on name, so we need to handle this carefully.
	 */
	async _ensureMasterDataWithExtras(
		table: any,
		nameColumn: any,
		dataMap: Map<string, { accountId?: string | null }>,
	): Promise<Map<string, string>> {
		if (dataMap.size === 0) {
			return new Map();
		}

		const entries = Array.from(dataMap.entries());
		const nameList = entries.map(([name]) => name);

		// First, find existing authors by name
		const existingRecords = await db
			.select({ id: table.id, name: nameColumn, accountId: table.accountId })
			.from(table)
			.where(inArray(nameColumn, nameList));

		const existingByName = new Map<string, { id: string; accountId: string | null }>();
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
				await db.update(table).set({ accountId: data.accountId }).where(eq(nameColumn, name));
			}
		}

		// Insert new authors that don't exist
		const newEntries = entries.filter(([name]) => !existingByName.has(name));
		if (newEntries.length > 0) {
			await db.insert(table).values(
				newEntries.map(([name, data]) => ({
					name,
					accountId: data.accountId || null,
				})),
			);

			// Fetch the newly inserted records
			const newRecords = await db
				.select({ id: table.id, name: nameColumn, accountId: table.accountId })
				.from(table)
				.where(
					inArray(
						nameColumn,
						newEntries.map(([name]) => name),
					),
				);

			for (const r of newRecords) {
				if (!existingByName.has(r.name)) {
					existingByName.set(r.name, { id: r.id, accountId: r.accountId });
				}
			}
		}

		// Return map of name -> id
		return new Map(Array.from(existingByName.entries()).map(([name, data]) => [name, data.id]));
	},

	/**
	 * Imports media data from a ZIP file path.
	 */
	async importSourceZip(mediaSourceId: string, zipFilePath: string) {
		const mediaSource = await db.query.mediaSources.findFirst({
			where: eq(mediaSources.id, mediaSourceId),
		});

		if (!mediaSource) {
			throw new Error("Media source not found");
		}

		// Helper to open zip and get entries
		const loadZip = (): Promise<{
			zipfile: yauzl.ZipFile;
			entries: Map<string, yauzl.Entry>;
			dumpData: any;
		}> => {
			return new Promise((resolve, reject) => {
				yauzl.open(zipFilePath, { lazyEntries: true, autoClose: false }, (err, openedZipfile) => {
					if (err || !openedZipfile) {
						return reject(err || new Error("Failed to open zip"));
					}

					const rejectAndClose = (error: Error) => {
						openedZipfile.close();
						reject(error);
					};

					openedZipfile.on("error", rejectAndClose);

					const entries = new Map<string, yauzl.Entry>();
					let dumpData: any = null;
					let dumpEntry: yauzl.Entry | null = null;

					openedZipfile.readEntry();
					openedZipfile.on("entry", (entry) => {
						entries.set(entry.fileName, entry);
						if (entry.fileName === "dump.json") {
							dumpEntry = entry;
						}
						openedZipfile.readEntry();
					});

					openedZipfile.on("end", () => {
						if (dumpEntry) {
							openedZipfile.openReadStream(dumpEntry, (readErr, readStream) => {
								if (readErr || !readStream) {
									return rejectAndClose(readErr || new Error("Failed to read dump.json"));
								}
								const chunks: Buffer[] = [];
								readStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
								readStream.on("end", () => {
									try {
										const buffer = Buffer.concat(chunks);
										dumpData = JSON.parse(buffer.toString("utf-8"));
										resolve({ zipfile: openedZipfile, entries, dumpData });
									} catch (e) {
										rejectAndClose(e as Error);
									}
								});
								readStream.on("error", rejectAndClose);
							});
						} else {
							rejectAndClose(new Error("dump.json not found in ZIP"));
						}
					});
				});
			});
		};

		let zipfile: yauzl.ZipFile;
		let entries: Map<string, yauzl.Entry>;
		let dumpData: any;

		const result = await loadZip();
		zipfile = result.zipfile;
		entries = result.entries;
		dumpData = result.dumpData;

		if (!Array.isArray(dumpData)) {
			zipfile.close();
			throw new Error("Invalid dump format");
		}

		const driver = getDriver(mediaSource);

		try {
			// Process files
			for (const item of dumpData) {
				if (item.filePath) {
					try {
						validateRelativePath(item.filePath);
					} catch (_e) {
						continue;
					}

					const imagePathInZip = `images/${item.filePath}`;
					const entry = entries.get(imagePathInZip);

					if (entry) {
						await new Promise<void>((resolve, reject) => {
							zipfile.openReadStream(entry, (err, readStream) => {
								if (err || !readStream) {
									return reject(err || new Error(`Failed to read stream for ${entry.fileName}`));
								}

								const chunks: Buffer[] = [];
								readStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
								readStream.on("end", async () => {
									try {
										const content = Buffer.concat(chunks);
										await driver.put(item.filePath, content);
										resolve();
									} catch (e) {
										reject(e);
									}
								});
								readStream.on("error", reject);
							});
						});
					}
				}
			}
		} finally {
			zipfile.close();
		}

		// Process metadata using bulk restore logic
		// This reuses the optimized batch insertion logic from restoreSource
		const restoreResult = await this.restoreSource(mediaSourceId, dumpData);

		return {
			success: true,
			importedCount: restoreResult.processed,
			skippedCount: restoreResult.skipped,
			errors: restoreResult.errors,
			message: `Successfully imported ${restoreResult.processed} items (Skipped: ${restoreResult.skipped})`,
		};
	},

	/**
	 * Generates a dump of the media source.
	 * Returns a JSON object or a ReadableStream for ZIP download.
	 */
	async createDump(mediaSourceId: string, mode: "json" | "zip" = "json") {
		// 1. Fetch Media Source Info (needed for Driver)
		const mediaSource = await db.query.mediaSources.findFirst({
			where: eq(mediaSources.id, mediaSourceId),
		});

		if (!mediaSource) {
			throw new Error("Media Source not found");
		}

		if (mode === "json") {
			const mediaList = await db.query.medias.findMany({
				where: eq(medias.mediaSourceId, mediaSourceId),
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
			});
			return this._transformMediaList(mediaList);
		}

		// ZIP Mode: Streaming Implementation
		const driver = getDriver(mediaSource);
		const archiver = (await import("archiver")).default;
		const { PassThrough, Readable } = await import("node:stream");
		const fsSync = await import("node:fs");
		const os = await import("node:os");
		const { randomUUID } = await import("node:crypto");

		const passThrough = new PassThrough();
		const archive = archiver("zip", {
			zlib: { level: 9 },
		});

		let tempJsonPath: string | null = null;
		const cleanup = async () => {
			if (tempJsonPath) {
				try {
					await fsSync.promises.unlink(tempJsonPath);
				} catch (_e) {
					// ignore
				}
			}
		};

		archive.on("error", async (_err: unknown) => {
			await cleanup();
		});

		archive.pipe(passThrough);

		(async () => {
			let jsonStream: import("node:fs").WriteStream | undefined;
			try {
				tempJsonPath = path.join(os.tmpdir(), `dump-${randomUUID()}.json`);
				jsonStream = fsSync.createWriteStream(tempJsonPath);

				jsonStream.write("[\n");

				const limit = 50;
				let offset = 0;
				let hasMore = true;
				let isFirst = true;

				while (hasMore) {
					const mediaList = await db.query.medias.findMany({
						where: eq(medias.mediaSourceId, mediaSourceId),
						limit,
						offset,
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
						orderBy: medias.id, // Ensure stable ordering
					});

					if (mediaList.length < limit) {
						hasMore = false;
					}
					offset += limit;

					if (mediaList.length === 0 && isFirst) {
						hasMore = false;
						break;
					}
					if (mediaList.length === 0) {
						hasMore = false;
						break;
					}

					const transformedItems = this._transformMediaList(mediaList);

					for (const item of transformedItems) {
						if (!isFirst) {
							jsonStream.write(",\n");
						}
						jsonStream.write(JSON.stringify(item, null, 2));
						isFirst = false;

						if (item.filePath) {
							try {
								const buffer = await driver.get(item.filePath);
								archive.append(buffer, { name: `images/${item.filePath}` });
							} catch (_e) {
								// ignore missing files
							}
						}
					}
				}

				jsonStream.write("\n]");
				await new Promise<void>((resolve, reject) => {
					jsonStream?.end(() => resolve());
					jsonStream?.on("error", reject);
				});

				archive.append(fsSync.createReadStream(tempJsonPath), {
					name: "dump.json",
				});
			} catch (err) {
				logger.error({ err }, "Failed to create dump");
				archive.abort();
				jsonStream?.destroy();
			} finally {
				await archive.finalize();
				passThrough.on("close", cleanup);
				passThrough.on("end", cleanup);
			}
		})();

		return Readable.toWeb(passThrough) as unknown as ReadableStream;
	},

	// Helper to transform media list to dump format
	_transformMediaList(mediaList: any[]): MediaDumpItem[] {
		return mediaList.map((media: any) => {
			// Extract tags
			const simpleTags = media.tags.map((mt: any) => ({
				name: mt.tag.name,
				type: mt.tagType,
				confidence: mt.confidence,
				source: mt.source,
			}));

			// Extract authors
			const simpleAuthors = media.authors.map((ma: any) => ({
				name: ma.author.name,
				accountId: ma.author.accountId,
			}));

			// Extract characters
			const simpleCharacters = media.characters.map((mc: any) => ({
				name: mc.character.name,
				description: mc.character.description,
				confidence: mc.confidence,
				linkedIps: mc.character.ips?.map((ci: any) => ci.ip.name),
				source: mc.source,
			}));

			// Extract IPs
			const simpleIps = media.ips.map((mi: any) => ({
				name: mi.ip.name,
				description: mi.ip.description,
				confidence: mi.confidence,
				source: mi.source,
			}));

			// Extract Projects
			const simpleProjects = media.projects.map((mp: any) => ({
				name: mp.project.name,
				description: mp.project.description,
			}));

			// Extract source URLs
			const sourceUrls = media.urls.map((u: any) => u.url);

			return {
				id: media.id,
				filePath: media.filePath,
				fileName: media.fileName,
				description: media.description,
				width: media.width,
				height: media.height,
				fileSize: media.fileSize,
				mediaType: media.mediaType,
				createdAt: media.createdAt,
				modifiedAt: media.modifiedAt,
				// indexedAt: media.indexedAt, // Not in schema

				// Essential metadata
				sourceUrls,

				// AI Generation Info
				generationInfo: media.generationInfo
					? {
							prompt: media.generationInfo.prompt,
							negativePrompt: media.generationInfo.negativePrompt,
							modelName: media.generationInfo.modelName,
							seed: media.generationInfo.seed,
							steps: media.generationInfo.steps,
							cfgScale: media.generationInfo.cfgScale,
							aiGenerated: media.generationInfo.aiGenerated,
							workflow: media.generationInfo.workflow,
							metadata: media.generationInfo.metadata,
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
