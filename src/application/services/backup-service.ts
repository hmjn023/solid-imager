import fs from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Open } from "unzipper";
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
// ...
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
    // biome-ignore lint/suspicious/noExplicitAny: complex dump
    items: any[]
  ) {
    const mediaSource = await db.query.mediaSources.findFirst({
      where: eq(mediaSources.id, mediaSourceId),
    });

    if (!mediaSource) {
      throw new Error("Media source not found");
    }

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

    // biome-ignore lint/suspicious/noExplicitAny: complex structure
    const validItems: any[] = [];
    const errorMessages: string[] = [];
    let skippedCount = 0;

    for (const item of items) {
      if (!(item.filePath && item.fileName)) {
        skippedCount++;
        continue;
      }

      try {
        validateRelativePath(item.filePath);
      } catch (e) {
        skippedCount++;
        errorMessages.push((e as Error).message);
        continue;
      }

      if (isLocal) {
        const fullPath = path.join(basePath, item.filePath);
        try {
          await fs.access(fullPath);
        } catch {
          skippedCount++;
          continue;
        }
      }
      validItems.push(item);
    }
    return { validItems, skippedCount, errorMessages };
  },

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: data processing
  // biome-ignore lint/suspicious/noExplicitAny: complex structure
  async _restoreMasterData(validItems: any[]) {
    const tagNames = new Set<string>();
    const authorNames = new Set<string>();
    const projectNames = new Set<string>();
    const charNames = new Set<string>();
    const ipNames = new Set<string>();

    for (const item of validItems) {
      if (item.tags) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic item
        for (const t of item.tags as any[]) {
          if (t.name) {
            tagNames.add(t.name);
          }
        }
      }
      if (item.authors) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic item
        for (const a of item.authors as any[]) {
          if (a.name) {
            authorNames.add(a.name);
          }
        }
      }
      if (item.projects) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic item
        for (const p of item.projects as any[]) {
          if (p.name) {
            projectNames.add(p.name);
          }
        }
      }
      if (item.characters) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic item
        for (const c of item.characters as any[]) {
          if (c.name) {
            charNames.add(c.name);
          }
        }
      }
      if (item.ips) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic item
        for (const i of item.ips as any[]) {
          if (i.name) {
            ipNames.add(i.name);
          }
        }
      }
    }

    const tagMap = await this._ensureMasterData(tags, tags.name, tagNames, {
      source: "restored",
    });
    const authorMap = await this._ensureMasterData(
      authors,
      authors.name,
      authorNames,
      {}
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

  // biome-ignore lint/suspicious/noExplicitAny: complex structure
  async _restoreMediaRecords(mediaSourceId: string, validItems: any[]) {
    const mediaValues = validItems.map((item) => ({
      mediaSourceId,
      filePath: item.filePath,
      fileName: item.fileName,
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

    await db
      .insert(medias)
      .values(mediaValues)
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
  },

  // biome-ignore lint/suspicious/noExplicitAny: complex structure
  async _mapMediaPathsToIds(mediaSourceId: string, validItems: any[]) {
    // Parameter limit avoidance: Split validItems into chunks
    const ChunkSize = 10_000;
    const storedMedias: { id: string; filePath: string }[] = [];

    for (let i = 0; i < validItems.length; i += ChunkSize) {
      const chunk = validItems.slice(i, i + ChunkSize);
      const chunkResults = await db.query.medias.findMany({
        where: and(
          eq(medias.mediaSourceId, mediaSourceId),
          inArray(
            medias.filePath,
            chunk.map((item) => item.filePath)
          )
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
    // biome-ignore lint/suspicious/noExplicitAny: complex structure
    validItems: any[];
    mediaPathToId: Map<string, string>;
    tagMap: Map<string, string>;
    authorMap: Map<string, string>;
    projectMap: Map<string, string>;
    ipMap: Map<string, string>;
    charMap: Map<string, string>;
  }) {
    // biome-ignore lint/suspicious/noExplicitAny: complex structure
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
      const mediaId = mediaPathToId.get(item.filePath);
      if (!mediaId) {
        continue;
      }

      if (item.tags) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic item
        for (const t of item.tags as any[]) {
          const tagId = t.name ? tagMap.get(t.name) : undefined;
          if (tagId) {
            mediaTagsData.push({
              mediaId,
              tagId,
              tagType: (t.type === "positive" || t.type === "negative"
                ? t.type
                : "positive") as "positive" | "negative",
              confidence: t.confidence || null,
              source: "restored",
            });
          }
        }
      }

      if (item.authors) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic item
        for (const a of item.authors as any[]) {
          const authorId = a.name ? authorMap.get(a.name) : undefined;
          if (authorId) {
            mediaAuthorsData.push({ mediaId, authorId });
          }
        }
      }

      if (item.projects) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic item
        for (const p of item.projects as any[]) {
          const projectId = p.name ? projectMap.get(p.name) : undefined;
          if (projectId) {
            mediaProjectsData.push({ mediaId, projectId });
          }
        }
      }

      if (item.ips) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic item
        for (const i of item.ips as any[]) {
          const ipId = i.name ? ipMap.get(i.name) : undefined;
          if (ipId) {
            mediaIpsData.push({ mediaId, ipId, source: "restored" });
          }
        }
      }

      if (item.characters) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic item
        for (const c of item.characters as any[]) {
          const charId = c.name ? charMap.get(c.name) : undefined;
          if (charId) {
            mediaCharsData.push({
              mediaId,
              characterId: charId,
              confidence: c.confidence || null,
              source: "restored",
            });
          }
        }
      }

      if (item.sourceUrls) {
        for (const url of item.sourceUrls as string[]) {
          mediaUrlsData.push({ mediaId, url });
        }
      }

      if (item.generationInfo) {
        const { mediaId: _, ...info } = item.generationInfo;
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

    if (mediaTagsData.length) {
      await db.insert(mediaTags).values(mediaTagsData).onConflictDoNothing();
    }
    if (mediaAuthorsData.length) {
      await db
        .insert(mediaAuthors)
        .values(mediaAuthorsData)
        .onConflictDoNothing();
    }
    if (mediaProjectsData.length) {
      await db
        .insert(mediaProjects)
        .values(mediaProjectsData)
        .onConflictDoNothing();
    }
    if (mediaCharsData.length) {
      await db
        .insert(mediaCharacters)
        .values(mediaCharsData)
        .onConflictDoNothing();
    }
    if (mediaIpsData.length) {
      await db.insert(mediaIps).values(mediaIpsData).onConflictDoNothing();
    }
    if (mediaUrlsData.length) {
      await db.insert(mediaUrls).values(mediaUrlsData).onConflictDoNothing();
    }

    if (mediaGenInfoData.length) {
      await db
        .insert(mediaGenerationInfo)
        .values(mediaGenInfoData)
        .onConflictDoNothing();
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
    const _importedCount = 0;

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
      // Legacy full-load for JSON mode (use with caution on large datasets)
      // Reuse the logic via a helper or simple query if needed, but for now duplicate
      // or keep the existing query structure but non-chunked?
      // To avoid code duplication, we could use the chunked iterator to build the array.

      // We can just query all at once for JSON mode as before, assuming JSON mode is for smaller debug exports.
      // Or better, forbid JSON mode for large datasets?
      // Let's stick to the previous implementation for JSON mode for now to minimize risk,
      // but we need to re-implement the query since I am replacing the method.

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

    // Cleanup function references
    let tempJsonPath: string | null = null;
    const cleanup = async () => {
      if (tempJsonPath) {
        try {
          await fsSync.promises.unlink(tempJsonPath); // Use fsSync.promises for async unlink
        } catch (_e) {
          // ignore
        }
      }
    };

    archive.on("error", async (_err: unknown) => {
      await cleanup();
    });

    // Ensure cleanup on ambiguous close/end if possible, or reliance on end triggers.
    // Ideally we hook into the stream completion, but for response streams, the server handles it.
    // We can clean up when archiving is finalized.

    archive.pipe(passThrough);

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Streaming logic is complex
    (async () => {
      try {
        tempJsonPath = path.join(os.tmpdir(), `dump-${randomUUID()}.json`);
        const jsonStream = fsSync.createWriteStream(tempJsonPath);

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
            // If no items at all, write empty array
            hasMore = false;
            break;
          }
          if (mediaList.length === 0) {
            // No more items, but some were processed
            hasMore = false;
            break;
          }

          const transformedItems = this._transformMediaList(mediaList);

          for (const item of transformedItems) {
            // Write JSON
            if (!isFirst) {
              jsonStream.write(",\n");
            }
            jsonStream.write(JSON.stringify(item, null, 2));
            isFirst = false;

            // Add image to archive
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
          jsonStream.end(() => resolve());
          jsonStream.on("error", reject);
        });

        // Append the complete JSON dump file
        archive.append(fsSync.createReadStream(tempJsonPath), {
          name: "dump.json",
        });
      } catch (_err) {
        // Can't easily signal error to downstream if headers sent, but we can abort archive
        archive.abort();
      } finally {
        await archive.finalize();
        // We can delete the temp file after finalization (which means it's been read into the zip stream?)
        // Wait, archiver reads the file *during* pipe. We must not delete it until archive emits 'end' or we are sure.
        // Actually, we can just let OS temp cleanup handle it or try to delete after a delay?
        // Safer: Delete it in the 'end' event of the *passThrough* stream or archive.
        // But since this is a background async function, we can await the stream finish?
        // For now, we will just start the cleanup with a small delay or rely on implicit cleanup.
        // A better way is:
        passThrough.on("close", cleanup);
        passThrough.on("end", cleanup);
      }
    })();

    return Readable.toWeb(passThrough) as ReadableStream;
  },

  // Helper to transform media list to dump format
  // biome-ignore lint/suspicious/noExplicitAny: complex structure
  _transformMediaList(mediaList: any[]) {
    // biome-ignore lint/suspicious/noExplicitAny: explicit any needed
    return mediaList.map((media: any) => {
      // Extract tags
      // biome-ignore lint/suspicious/noExplicitAny: inferrence failing
      const simpleTags = media.tags.map((mt: any) => ({
        name: mt.tag.name,
        type: mt.tagType,
        confidence: mt.confidence,
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
        confidence: mc.confidence,
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
        indexedAt: media.indexedAt,

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

  // Helper methods for Restore (processRestoreItem, restoreMediaRecord etc. removed as they are deprecated)
};
