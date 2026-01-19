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
import { getDriver } from "~/infrastructure/storage/factory";

/**
 * Validates that a path is relative and does not contain traversal segments.
 */
function validateRelativePath(p: string): void {
  if (!p) {
    return;
  }
  const normalized = path.normalize(p);
  if (path.isAbsolute(p) || p.startsWith("/") || normalized.includes("..")) {
    throw new Error(`Invalid path in backup: ${p}`);
  }
}

/**
 * Service for handling media source backups, restoration, and imports.
 */
export const BackupService = {
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

    const { validItems, skippedCount, errorMessages } =
      // biome-ignore lint/suspicious/noExplicitAny: complex structure
      await this._filterValidItems(items as any[], mediaSource, {
        skipFileCheck: false,
      });

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

  /**
   * Imports rich metadata from a JSON list without requiring physical files to exist.
   * Useful for pre-filling metadata for pending downloads.
   */
  async importMetadata(mediaSourceId: string, items: unknown[]) {
    const mediaSource = await db.query.mediaSources.findFirst({
      where: eq(mediaSources.id, mediaSourceId),
    });

    if (!mediaSource) {
      throw new Error("Media source not found");
    }

    const { validItems, skippedCount, errorMessages } =
      // biome-ignore lint/suspicious/noExplicitAny: complex structure
      await this._filterValidItems(items as any[], mediaSource, {
        skipFileCheck: true,
      });

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

    // Media Handling (Creates or updates metadata)
    await this._restoreMediaRecords(mediaSourceId, validItems, "pending");

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

  async _filterValidItems(
    // biome-ignore lint/suspicious/noExplicitAny: complex structure
    items: any[],
    // biome-ignore lint/suspicious/noExplicitAny: complex structure
    mediaSource: any,
    options: { skipFileCheck?: boolean } = {}
  ) {
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

      if (isLocal && !options.skipFileCheck) {
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
    const authorMapData = new Map<string, string | null>();
    const projectNames = new Set<string>();
    const charNames = new Set<string>();
    const ipNames = new Set<string>();

    for (const item of validItems) {
      if (item.tags) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic
        for (const t of item.tags as any[]) {
          if (t.name) {
            tagNames.add(t.name);
          }
        }
      }
      if (item.authors) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic
        for (const a of item.authors as any[]) {
          if (a.name) {
            const currentId = a.accountId || a.account_id || null;
            if (
              !authorMapData.has(a.name) ||
              (currentId && !authorMapData.get(a.name))
            ) {
              authorMapData.set(a.name, currentId);
            }
          }
        }
      }
      if (item.projects) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic
        for (const p of item.projects as any[]) {
          if (p.name) {
            projectNames.add(p.name);
          }
        }
      }
      if (item.characters) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic
        for (const c of item.characters as any[]) {
          if (c.name) {
            charNames.add(c.name);
          }
        }
      }
      if (item.ips) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic
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
    const authorMap = await this._ensureAuthors(authorMapData);

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
    // biome-ignore lint/suspicious/noExplicitAny: complex structure
    validItems: any[],
    defaultStatus: "active" | "pending" = "active"
  ) {
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
      status: defaultStatus,
    }));

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
            status: sql`excluded.status`,
          },
        });
    }
  },

  // biome-ignore lint/suspicious/noExplicitAny: complex structure
  async _mapMediaPathsToIds(mediaSourceId: string, validItems: any[]) {
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
        // biome-ignore lint/suspicious/noExplicitAny: dynamic
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
        // biome-ignore lint/suspicious/noExplicitAny: dynamic
        for (const a of item.authors as any[]) {
          const authorId = a.name ? authorMap.get(a.name) : undefined;
          if (authorId) {
            mediaAuthorsData.push({ mediaId, authorId });
          }
        }
      }

      if (item.projects) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic
        for (const p of item.projects as any[]) {
          const projectId = p.name ? projectMap.get(p.name) : undefined;
          if (projectId) {
            mediaProjectsData.push({ mediaId, projectId });
          }
        }
      }

      if (item.ips) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic
        for (const i of item.ips as any[]) {
          const ipId = i.name ? ipMap.get(i.name) : undefined;
          if (ipId) {
            mediaIpsData.push({ mediaId, ipId, source: "restored" });
          }
        }
      }

      if (item.characters) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic
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
    // biome-ignore lint/suspicious/noExplicitAny: dynamic
    table: any,
    // biome-ignore lint/suspicious/noExplicitAny: dynamic
    nameColumn: any,
    names: Set<string>,
    // biome-ignore lint/suspicious/noExplicitAny: dynamic
    defaults: any
  ): Promise<Map<string, string>> {
    const nameList = Array.from(names);
    if (nameList.length === 0) {
      return new Map();
    }

    await db
      .insert(table)
      .values(nameList.map((name) => ({ name, ...defaults })))
      .onConflictDoNothing();

    const records = await db
      .select({ id: table.id, name: nameColumn })
      .from(table)
      .where(inArray(nameColumn, nameList));

    // biome-ignore lint/suspicious/noExplicitAny: dynamic
    return new Map(records.map((r: any) => [r.name, r.id]));
  },

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: bulk author processing logic
  async _ensureAuthors(
    authorsData: Map<string, string | null>
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (authorsData.size === 0) {
      return result;
    }

    // Step 1: Bulk search for existing authors by accountId and name
    const accountIds = Array.from(authorsData.values()).filter(
      (id): id is string => !!id
    );
    const names = Array.from(authorsData.keys());

    const existingByAccountId =
      accountIds.length > 0
        ? await db
            .select()
            .from(authors)
            .where(inArray(authors.accountId, accountIds))
        : [];

    const existingByName = await db
      .select()
      .from(authors)
      .where(inArray(authors.name, names));

    // Build lookup maps
    const byAccountId = new Map(
      existingByAccountId
        .filter((a) => a.accountId !== null)
        .map((a) => [a.accountId as string, a])
    );
    const byName = new Map(existingByName.map((a) => [a.name, a]));

    // Step 2: Determine which authors need to be created
    const toCreate: { name: string; accountId: string | null }[] = [];
    const toUpdate: { id: string; accountId: string }[] = [];

    for (const [name, accountId] of authorsData.entries()) {
      let existing = accountId ? byAccountId.get(accountId) : undefined;

      if (!existing) {
        existing = byName.get(name);
      }

      if (existing) {
        // If found by name but missing accountId, mark for update
        if (accountId && !existing.accountId) {
          toUpdate.push({ id: existing.id, accountId });
        }
        result.set(name, existing.id);
      } else {
        toCreate.push({ name, accountId });
      }
    }

    // Step 3: Bulk insert new authors
    if (toCreate.length > 0) {
      // Use onConflictDoNothing since we don't have unique constraints
      // Then fetch the inserted/existing records
      await db.insert(authors).values(toCreate).onConflictDoNothing();

      // Fetch all authors that were just created or already existed
      const createdNames = toCreate.map((a) => a.name);
      const inserted = await db
        .select()
        .from(authors)
        .where(inArray(authors.name, createdNames));

      for (const author of inserted) {
        result.set(author.name, author.id);
      }
    }

    // Step 4: Bulk update existing authors with missing accountId
    if (toUpdate.length > 0) {
      // Note: Drizzle doesn't have a native bulk update with different values per row
      // For now, we'll do individual updates, but this is still better than the original
      // sequential approach since we've already reduced DB round trips significantly
      await Promise.all(
        toUpdate.map((u) =>
          db
            .update(authors)
            .set({ accountId: u.accountId, updatedAt: new Date() })
            .where(eq(authors.id, u.id))
        )
      );
    }

    return result;
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

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy logic
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
            orderBy: medias.id,
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

  // biome-ignore lint/suspicious/noExplicitAny: complex structure
  _transformMediaList(mediaList: any[]) {
    // biome-ignore lint/suspicious/noExplicitAny: map item
    return mediaList.map((media: any) => {
      // biome-ignore lint/suspicious/noExplicitAny: mt
      const simpleTags = media.tags.map((mt: any) => ({
        name: mt.tag.name,
        type: mt.tagType,
        confidence: mt.confidence,
      }));

      // biome-ignore lint/suspicious/noExplicitAny: ma
      const simpleAuthors = media.authors.map((ma: any) => ({
        name: ma.author.name,
        accountId: ma.author.accountId,
      }));

      // biome-ignore lint/suspicious/noExplicitAny: mc
      const simpleCharacters = media.characters.map((mc: any) => ({
        name: mc.character.name,
        description: mc.character.description,
        confidence: mc.confidence,
      }));

      // biome-ignore lint/suspicious/noExplicitAny: mi
      const simpleIps = media.ips.map((mi: any) => ({
        name: mi.ip.name,
        description: mi.ip.description,
      }));

      // biome-ignore lint/suspicious/noExplicitAny: mp
      const simpleProjects = media.projects.map((mp: any) => ({
        name: mp.project.name,
        description: mp.project.description,
      }));

      // biome-ignore lint/suspicious/noExplicitAny: u
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
        sourceUrls,
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
