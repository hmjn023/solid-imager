import fs from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Open } from "unzipper";
import {
  type MediaDumpItem,
  mediaDumpItemSchema,
} from "~/domain/media/schemas";
import { db } from "~/infrastructure/db";
import {
  authors,
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
import { queueGenerationJobs } from "~/infrastructure/jobs/media-registration";
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
  // ... (restoreSource)

  /**
   * Restores media metadata from a JSON dump.
   * Optimized with Bulk Operations.
   */
  async restoreSource(
    mediaSourceId: string,
    // biome-ignore lint/suspicious/noExplicitAny: complex dump structure but partially typed
    items: any[]
  ) {
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

    // Master Data Handling
    const { tagMap, authorMap, projectMap, ipMap, charMap } =
      await this._restoreMasterData(validItems);

    // Media Handling
    await this._restoreMediaRecords(mediaSourceId, validItems);

    const mediaPathToId = await this._mapMediaPathsToIds(
      mediaSourceId,
      validItems
    );

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

    // Queue generation jobs (thumbnails, etc.)
    // Skip metadata extraction to preserve restored metadata
    const restoredItems = Array.from(mediaPathToId.entries()).map(
      ([filePath, id]) => ({ id, filePath })
    );

    // Dynamic import to avoid circular dependency potentially, or just standard import
    // Using standard import as we are in application layer using infrastructure
    queueGenerationJobs({
      mediaSourceId,
      items: restoredItems,
      basePath: (mediaSource.connectionInfo as { path: string }).path,
      skipMetadataExtraction: true,
    });

    return {
      processed: validItems.length,
      skipped: skippedCount,
      errors: errorMessages,
    };
  },

  // biome-ignore lint/suspicious/noExplicitAny: complex structure
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

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: data processing
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
    const authorMap = await this._ensureMasterDataWithExtras(
      authors,
      authors.name,
      authorData
    );
    const projectMap = await this._ensureMasterData(
      projects,
      projects.name,
      projectNames,
      { description: "" }
    );
    const ipMap = await this._ensureMasterData(ips, ips.name, ipNames, {
      description: "",
      source: "restored",
    });
    const charMap = await this._ensureMasterData(
      characters,
      characters.name,
      charNames,
      { description: "", source: "restored" }
    );

    return { tagMap, authorMap, projectMap, ipMap, charMap };
  },

  async _restoreMediaRecords(
    mediaSourceId: string,
    validItems: MediaDumpItem[]
  ) {
    const mediaValues = validItems.map((item) => ({
      mediaSourceId,
      // biome-ignore lint/style/noNonNullAssertion: Filtered in _filterValidItems
      filePath: item.filePath!,
      // biome-ignore lint/style/noNonNullAssertion: Filtered in _filterValidItems
      fileName: item.fileName!,
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
            width: sql`excluded.width`,
            height: sql`excluded.height`,
            fileSize: sql`excluded.file_size`,
          },
        });
    }
  },

  async _mapMediaPathsToIds(
    mediaSourceId: string,
    validItems: MediaDumpItem[]
  ) {
    // Parameter limit avoidance: Split validItems into chunks
    const ChunkSize = 10_000;
    const storedMedias: { id: string; filePath: string }[] = [];

    for (let i = 0; i < validItems.length; i += ChunkSize) {
      const chunk = validItems.slice(i, i + ChunkSize);
      // We need to filter out items with undefined filePath (though filtered before)
      const filePaths = chunk
        .map((item) => item.filePath)
        .filter((p): p is string => !!p);

      if (filePaths.length === 0) {
        continue;
      }

      const chunkResults = await db.query.medias.findMany({
        where: and(
          eq(medias.mediaSourceId, mediaSourceId),
          inArray(medias.filePath, filePaths)
        ),
        columns: { id: true, filePath: true },
      });
      storedMedias.push(...chunkResults);
    }

    return new Map(storedMedias.map((m) => [m.filePath, m.id]));
  },

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: data processing
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
    // biome-ignore lint/suspicious/noExplicitAny: complex structure for db insert
    const mediaTagsData: any[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: complex structure
    const mediaAuthorsData: any[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: complex structure
    const mediaProjectsData: any[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: complex structure
    const mediaCharsData: any[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: complex structure
    const mediaIpsData: any[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: complex structure
    const mediaUrlsData: any[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: complex structure
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
              tagType: (t.type === "positive" || t.type === "negative"
                ? t.type
                : "positive") as "positive" | "negative",
              // confidence: t.confidence || null, // Not in schema yet, but db supports it
              source: "restored",
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
            mediaIpsData.push({ mediaId, ipId, source: "restored" });
          }
        }
      }

      if (item.characters) {
        for (const c of item.characters) {
          const charId = c.name ? charMap.get(c.name) : undefined;
          if (charId) {
            mediaCharsData.push({
              mediaId,
              characterId: charId,
              // confidence: c.confidence || null, // Not in schema yet
              source: "restored",
            });
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
      await db
        .delete(mediaAuthors)
        .where(inArray(mediaAuthors.mediaId, mediaIds));
      await db
        .delete(mediaProjects)
        .where(inArray(mediaProjects.mediaId, mediaIds));
      await db
        .delete(mediaCharacters)
        .where(inArray(mediaCharacters.mediaId, mediaIds));
      await db.delete(mediaIps).where(inArray(mediaIps.mediaId, mediaIds));
      await db.delete(mediaUrls).where(inArray(mediaUrls.mediaId, mediaIds));
      await db
        .delete(mediaGenerationInfo)
        .where(inArray(mediaGenerationInfo.mediaId, mediaIds));
    }

    // biome-ignore lint/suspicious/noExplicitAny: generic table and data
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
    // biome-ignore lint/suspicious/noExplicitAny: complex structure
    table: any,
    // biome-ignore lint/suspicious/noExplicitAny: complex structure
    nameColumn: any,
    names: Set<string>,
    // biome-ignore lint/suspicious/noExplicitAny: complex structure
    defaults: any
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

    // biome-ignore lint/suspicious/noExplicitAny: dynamic record
    return new Map(records.map((r: any) => [r.name, r.id]));
  },

  /**
   * Ensures master data with extra fields (specifically for authors with accountId).
   * Authors table does NOT have unique constraint on name, so we need to handle this carefully.
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: logic is slightly complex due to accountId priority
  async _ensureMasterDataWithExtras(
    // biome-ignore lint/suspicious/noExplicitAny: complex structure
    table: any,
    // biome-ignore lint/suspicious/noExplicitAny: complex structure
    nameColumn: any,
    dataMap: Map<string, { accountId?: string | null }>
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
        await db
          .update(table)
          .set({ accountId: data.accountId })
          .where(eq(nameColumn, name));
      }
    }

    // Insert new authors that don't exist
    const newEntries = entries.filter(([name]) => !existingByName.has(name));
    if (newEntries.length > 0) {
      await db.insert(table).values(
        newEntries.map(([name, data]) => ({
          name,
          accountId: data.accountId || null,
        }))
      );

      // Fetch the newly inserted records
      const newRecords = await db
        .select({ id: table.id, name: nameColumn, accountId: table.accountId })
        .from(table)
        .where(
          inArray(
            nameColumn,
            newEntries.map(([name]) => name)
          )
        );

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
      ])
    );
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

    // Open ZIP from file path using unzipper
    const directory = await Open.file(zipFilePath);

    const dumpFile = directory.files.find((f) => f.path === "dump.json");
    if (!dumpFile) {
      throw new Error("dump.json not found in ZIP");
    }

    const dumpContent = await dumpFile.buffer();
    const dumpData = JSON.parse(dumpContent.toString("utf-8"));

    if (!Array.isArray(dumpData)) {
      throw new Error("Invalid dump format");
    }

    const driver = getDriver(mediaSource);

    // Process files
    for (const item of dumpData) {
      if (item.filePath) {
        try {
          validateRelativePath(item.filePath);
        } catch (_e) {
          continue;
        }

        const imagePathInZip = `images/${item.filePath}`;
        const imageFile = directory.files.find(
          (f) => f.path === imagePathInZip
        );

        if (imageFile) {
          const content = await imageFile.buffer();
          await driver.put(item.filePath, content);
        }
      }
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
          characters: { with: { character: true } },
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

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Streaming logic is complex
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
              characters: { with: { character: true } },
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
      } catch (_err) {
        archive.abort();
        jsonStream?.destroy();
      } finally {
        await archive.finalize();
        passThrough.on("close", cleanup);
        passThrough.on("end", cleanup);
      }
    })();

    return Readable.toWeb(passThrough) as ReadableStream;
  },

  // Helper to transform media list to dump format
  // biome-ignore lint/suspicious/noExplicitAny: complex structure
  _transformMediaList(mediaList: any[]): MediaDumpItem[] {
    // biome-ignore lint/suspicious/noExplicitAny: explicit any needed
    return mediaList.map((media: any) => {
      // Extract tags
      // biome-ignore lint/suspicious/noExplicitAny: inferrence failing
      const simpleTags = media.tags.map((mt: any) => ({
        name: mt.tag.name,
        type: mt.tagType,
        // confidence: mt.confidence, // Not in schema
      }));

      // Extract authors
      // biome-ignore lint/suspicious/noExplicitAny: inferrence failing
      const simpleAuthors = media.authors.map((ma: any) => ({
        name: ma.author.name,
        accountId: ma.author.accountId,
      }));

      // Extract characters
      // biome-ignore lint/suspicious/noExplicitAny: inferrence failing
      const simpleCharacters = media.characters.map((mc: any) => ({
        name: mc.character.name,
        description: mc.character.description,
        // confidence: mc.confidence, // Not in schema
      }));

      // Extract IPs
      // biome-ignore lint/suspicious/noExplicitAny: inferrence failing
      const simpleIps = media.ips.map((mi: any) => ({
        name: mi.ip.name,
        description: mi.ip.description,
      }));

      // Extract Projects
      // biome-ignore lint/suspicious/noExplicitAny: inferrence failing
      const simpleProjects = media.projects.map((mp: any) => ({
        name: mp.project.name,
        description: mp.project.description,
      }));

      // Extract source URLs
      // biome-ignore lint/suspicious/noExplicitAny: inferrence failing
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
