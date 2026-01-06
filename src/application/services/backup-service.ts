import fs from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Open } from "unzipper";
import { db, type TransactionClient } from "~/infrastructure/db";
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

// const _IMAGES_PREFIX = /^images\//;

/**
 * Service for handling media source backups, restoration, and imports.
 */
export const BackupService = {
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
    const storedMedias = await db.query.medias.findMany({
      where: and(
        eq(medias.mediaSourceId, mediaSourceId),
        inArray(
          medias.filePath,
          validItems.map((i) => i.filePath)
        )
      ),
      columns: { id: true, filePath: true },
    });
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
    let importedCount = 0;

    // Process files and metadata
    for (const item of dumpData) {
      const imagePathInZip = `images/${item.filePath}`;
      const imageFile = directory.files.find((f) => f.path === imagePathInZip);

      if (imageFile) {
        const content = await imageFile.buffer();
        await driver.put(item.filePath, content);
      }

      await db.transaction(async (tx) => {
        await this.processImportItem(
          tx as unknown as TransactionClient,
          mediaSourceId,
          item
        );
      });

      importedCount++;
    }

    return {
      success: true,
      importedCount,
      message: `Successfully imported ${importedCount} items`,
    };
  },

  /**
   * Generates a dump of the media source.
   * Returns a JSON object or a ReadableStream for ZIP download.
   */
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

    // 2. Fetch Media Data (Relational query)
    const mediaList = await db.query.medias.findMany({
      where: eq(medias.mediaSourceId, mediaSourceId),
      with: {
        generationInfo: true,
        urls: true,
        tags: {
          with: {
            tag: true,
          },
        },
        authors: {
          with: {
            author: true,
          },
        },
        characters: {
          with: {
            character: true,
          },
        },
        ips: {
          with: {
            ip: true,
          },
        },
        projects: {
          with: {
            project: true,
          },
        },
      },
    });

    // 3. Transform to "restoration-ready" format
    // biome-ignore lint/suspicious/noExplicitAny: inferrence failing
    const dumpData = mediaList.map((media: any) => {
      // Extract tags into a simple list of names/types
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

      // Extract source URLs (flattened)
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

        // Essential metadata for restoration
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
              workflow: media.generationInfo.workflow, // Full workflow json
              metadata: media.generationInfo.metadata, // Other metadata
            }
          : null,

        tags: simpleTags,
        authors: simpleAuthors,
        characters: simpleCharacters,
        ips: simpleIps,
        projects: simpleProjects,
      };
    });

    // 4. Handle Response based on Mode
    if (mode === "zip") {
      const driver = getDriver(mediaSource);
      const archiver = (await import("archiver")).default;
      const { PassThrough, Readable } = await import("node:stream");

      const passThrough = new PassThrough();
      const archive = archiver("zip", {
        zlib: { level: 9 },
      });

      // エラーハンドリング
      archive.on("error", (_err: unknown) => {
        // ignore
      });

      // パイプ接続
      archive.pipe(passThrough);

      // バックグラウンドでアーカイブ作成を開始
      (async () => {
        try {
          // メタデータJSONを追加
          archive.append(JSON.stringify(dumpData, null, 2), {
            name: "dump.json",
          });

          // 画像ファイルを順次追加
          for (const media of mediaList) {
            try {
              const buffer = await driver.get(media.filePath);
              archive.append(buffer, { name: `images/${media.filePath}` });
            } catch (_e) {
              // ignore
            }
          }
        } catch (_err) {
          // ignore
        } finally {
          // 完了またはエラー時にfinalize
          await archive.finalize();
        }
      })();

      // ストリームを即座に返す
      return Readable.toWeb(passThrough) as ReadableStream;
    }

    return dumpData;
  },

  // Helper methods for Restore
  // Helper methods for Restore
  async processRestoreItem(
    mediaSourceId: string,
    // biome-ignore lint/suspicious/noExplicitAny: complex item structure
    item: any,
    isLocal: boolean,
    basePath: string
  ): Promise<"processed" | "skipped"> {
    if (!(item.filePath && item.fileName)) {
      return "skipped";
    }

    if (isLocal) {
      const fullPath = path.join(basePath, item.filePath);
      try {
        await fs.access(fullPath);
      } catch {
        return "skipped";
      }
    }

    const mediaId = await this.restoreMediaRecord(mediaSourceId, item);
    if (!mediaId) {
      return "skipped";
    }

    if (item.generationInfo) {
      await this.restoreGenerationInfo(mediaId, item.generationInfo);
    }
    if (item.tags) {
      await this.restoreTags(mediaId, item.tags);
    }
    if (item.authors) {
      await this.restoreAuthors(mediaId, item.authors);
    }
    if (item.characters) {
      await this.restoreCharacters(mediaId, item.characters);
    }
    if (item.ips) {
      await this.restoreIps(mediaId, item.ips);
    }
    if (item.projects) {
      await this.restoreProjects(mediaId, item.projects);
    }
    if (item.sourceUrls) {
      await this.restoreUrls(mediaId, item.sourceUrls);
    }

    return "processed";
  },

  // biome-ignore lint/suspicious/noExplicitAny: complex item structure
  async restoreMediaRecord(mediaSourceId: string, item: any) {
    const existingMedia = await db.query.medias.findFirst({
      where: and(
        eq(medias.mediaSourceId, mediaSourceId),
        eq(medias.filePath, item.filePath)
      ),
    });

    const mediaValues = {
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
    };

    if (existingMedia) {
      await db
        .update(medias)
        .set(mediaValues)
        .where(eq(medias.id, existingMedia.id));
      return existingMedia.id;
    }
    const inserted = await db
      .insert(medias)
      .values({
        ...mediaValues,
        indexedAt: new Date(),
        status: "active",
      })
      .returning();
    return inserted[0].id;
  },

  // biome-ignore lint/suspicious/noExplicitAny: complex info structure
  async restoreGenerationInfo(mediaId: string, info: any) {
    const { mediaId: _, ...rest } = info;
    await db
      .insert(mediaGenerationInfo)
      .values({
        mediaId,
        ...rest,
      })
      .onConflictDoUpdate({
        target: mediaGenerationInfo.mediaId,
        set: { ...rest },
      });
  },

  // biome-ignore lint/suspicious/noExplicitAny: complex tags structure
  async restoreTags(mediaId: string, tagsList: any[]) {
    await db.delete(mediaTags).where(eq(mediaTags.mediaId, mediaId));
    for (const t of tagsList) {
      if (!t.name) {
        continue;
      }
      let tag = await db.query.tags.findFirst({
        where: eq(tags.name, t.name),
      });
      if (!tag) {
        const [insertedTag] = await db
          .insert(tags)
          .values({ name: t.name, source: "restored" })
          .onConflictDoNothing()
          .returning();

        tag = insertedTag;
        if (!tag) {
          tag = await db.query.tags.findFirst({ where: eq(tags.name, t.name) });
        }
      }
      if (tag) {
        await db
          .insert(mediaTags)
          .values({
            mediaId,
            tagId: tag.id,
            tagType: (t.type === "positive" || t.type === "negative"
              ? t.type
              : "positive") as "positive" | "negative",
            confidence: t.confidence || null,
            source: "restored",
          })
          .onConflictDoNothing();
      }
    }
  },

  // biome-ignore lint/suspicious/noExplicitAny: complex authors structure
  async restoreAuthors(mediaId: string, authorsList: any[]) {
    await db.delete(mediaAuthors).where(eq(mediaAuthors.mediaId, mediaId));
    for (const a of authorsList) {
      if (!a.name) {
        continue;
      }
      let author = await db.query.authors.findFirst({
        where: eq(authors.name, a.name),
      });
      if (!author) {
        const [insertedAuthor] = await db
          .insert(authors)
          .values({ name: a.name, accountId: a.accountId || null })
          .returning();
        author = insertedAuthor;
      }
      if (author) {
        await db
          .insert(mediaAuthors)
          .values({
            mediaId,
            authorId: author.id,
          })
          .onConflictDoNothing();
      }
    }
  },

  async restoreUrls(mediaId: string, sourceUrls: string[]) {
    for (const url of sourceUrls) {
      await db
        .insert(mediaUrls)
        .values({
          mediaId,
          url,
        })
        .onConflictDoNothing();
    }
  },

  // biome-ignore lint/suspicious/noExplicitAny: complex projects structure
  async restoreProjects(mediaId: string, projectsList: any[]) {
    await db.delete(mediaProjects).where(eq(mediaProjects.mediaId, mediaId));
    for (const p of projectsList) {
      if (!p.name) {
        continue;
      }
      let project = await db.query.projects.findFirst({
        where: eq(projects.name, p.name),
      });
      if (!project) {
        const [insertedProject] = await db
          .insert(projects)
          .values({ name: p.name, description: p.description || "" })
          .returning();
        project = insertedProject;
      }
      if (project) {
        await db
          .insert(mediaProjects)
          .values({
            mediaId,
            projectId: project.id,
          })
          .onConflictDoNothing();
      }
    }
  },

  // biome-ignore lint/suspicious/noExplicitAny: complex characters structure
  async restoreCharacters(mediaId: string, charactersList: any[]) {
    await db
      .delete(mediaCharacters)
      .where(eq(mediaCharacters.mediaId, mediaId));
    for (const c of charactersList) {
      if (!c.name) {
        continue;
      }
      // Note: IP association is tricky during flat restore.
      // We'll try to find existing character by name.
      // If we need to create one, we won't associate IP unless we can infer it confidently, which we can't here easily.
      let character = await db.query.characters.findFirst({
        where: eq(characters.name, c.name),
      });
      if (!character) {
        const [insertedCharacter] = await db
          .insert(characters)
          .values({
            name: c.name,
            description: c.description || "",
            source: "restored",
          })
          .returning();
        character = insertedCharacter;
      }
      if (character) {
        await db
          .insert(mediaCharacters)
          .values({
            mediaId,
            characterId: character.id,
            confidence: c.confidence || null,
            source: "restored",
          })
          .onConflictDoNothing();
      }
    }
  },

  // biome-ignore lint/suspicious/noExplicitAny: complex ips structure
  async restoreIps(mediaId: string, ipsList: any[]) {
    await db.delete(mediaIps).where(eq(mediaIps.mediaId, mediaId));
    for (const i of ipsList) {
      if (!i.name) {
        continue;
      }
      let ip = await db.query.ips.findFirst({
        where: eq(ips.name, i.name),
      });
      if (!ip) {
        const [insertedIp] = await db
          .insert(ips)
          .values({
            name: i.name,
            description: i.description || "",
            source: "restored",
          })
          .returning();
        ip = insertedIp;
      }
      if (ip) {
        await db
          .insert(mediaIps)
          .values({
            mediaId,
            ipId: ip.id,
            source: "restored",
          })
          .onConflictDoNothing();
      }
    }
  },

  // Helper methods for Import
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Legacy import logic
  async processImportItem(
    tx: TransactionClient,
    mediaSourceId: string,
    // biome-ignore lint/suspicious/noExplicitAny: complex item structure
    item: any
  ) {
    const [insertedMedia] = await tx
      .insert(medias)
      .values({
        mediaSourceId,
        filePath: item.filePath,
        fileName: item.fileName,
        mediaType: (item.mediaType === "image" || item.mediaType === "video"
          ? item.mediaType
          : "image") as "image" | "video",
        width: item.width || 0,
        height: item.height || 0,
        fileSize: item.fileSize || 0,
        description: item.description || null,
        createdAt: new Date(item.createdAt),
        modifiedAt: new Date(item.modifiedAt),
        indexedAt: new Date(item.indexedAt),
        status: "active",
      })
      .onConflictDoUpdate({
        target: [medias.mediaSourceId, medias.filePath],
        set: {
          description: item.description || null,
          modifiedAt: new Date(item.modifiedAt),
          width: item.width || 0,
          height: item.height || 0,
          fileSize: item.fileSize || 0,
        },
      })
      .returning();

    const mediaId = insertedMedia.id;

    // Tags
    if (Array.isArray(item.tags)) {
      await tx.delete(mediaTags).where(eq(mediaTags.mediaId, mediaId));
      for (const tag of item.tags) {
        let tagRecord = await tx.query.tags.findFirst({
          where: eq(tags.name, tag.name),
        });
        if (!tagRecord) {
          const [newTag] = await tx
            .insert(tags)
            .values({ name: tag.name, source: "imported" })
            .returning();
          tagRecord = newTag;
        }
        await tx.insert(mediaTags).values({
          mediaId,
          tagId: tagRecord.id,
          tagType: (tag.type === "positive" || tag.type === "negative"
            ? tag.type
            : "positive") as "positive" | "negative",
          confidence: tag.confidence || null,
          source: "imported",
        });
      }
    }

    // Authors
    if (Array.isArray(item.authors)) {
      await tx.delete(mediaAuthors).where(eq(mediaAuthors.mediaId, mediaId));
      for (const author of item.authors) {
        let authorRecord = await tx.query.authors.findFirst({
          where: eq(authors.name, author.name),
        });
        if (!authorRecord) {
          const [newAuthor] = await tx
            .insert(authors)
            .values({ name: author.name, accountId: author.accountId || null })
            .returning();
          authorRecord = newAuthor;
        }
        await tx
          .insert(mediaAuthors)
          .values({ mediaId, authorId: authorRecord.id });
      }
    }

    // Characters
    if (Array.isArray(item.characters)) {
      await tx
        .delete(mediaCharacters)
        .where(eq(mediaCharacters.mediaId, mediaId));
      for (const c of item.characters) {
        let charRecord = await tx.query.characters.findFirst({
          where: eq(characters.name, c.name),
        });
        if (!charRecord) {
          const [newChar] = await tx
            .insert(characters)
            .values({
              name: c.name,
              description: c.description || "",
              source: "imported",
            })
            .returning();
          charRecord = newChar;
        }
        await tx.insert(mediaCharacters).values({
          mediaId,
          characterId: charRecord.id,
          confidence: c.confidence || null,
          source: "imported",
        });
      }
    }

    // IPs
    if (Array.isArray(item.ips)) {
      await tx.delete(mediaIps).where(eq(mediaIps.mediaId, mediaId));
      for (const i of item.ips) {
        let ipRecord = await tx.query.ips.findFirst({
          where: eq(ips.name, i.name),
        });
        if (!ipRecord) {
          const [newIp] = await tx
            .insert(ips)
            .values({
              name: i.name,
              description: i.description || "",
              source: "imported",
            })
            .returning();
          ipRecord = newIp;
        }
        await tx
          .insert(mediaIps)
          .values({ mediaId, ipId: ipRecord.id, source: "imported" });
      }
    }

    // Projects
    if (Array.isArray(item.projects)) {
      await tx.delete(mediaProjects).where(eq(mediaProjects.mediaId, mediaId));
      for (const p of item.projects) {
        let projRecord = await tx.query.projects.findFirst({
          where: eq(projects.name, p.name),
        });
        if (!projRecord) {
          const [newProj] = await tx
            .insert(projects)
            .values({ name: p.name, description: p.description || "" })
            .returning();
          projRecord = newProj;
        }
        await tx
          .insert(mediaProjects)
          .values({ mediaId, projectId: projRecord.id });
      }
    }

    // Generation Info
    if (item.generationInfo) {
      const { mediaId: _, ...info } = item.generationInfo;
      await tx
        .insert(mediaGenerationInfo)
        .values({
          mediaId,
          ...info,
        })
        .onConflictDoUpdate({
          target: mediaGenerationInfo.mediaId,
          set: { ...info },
        });
    }

    // Source URLs
    if (Array.isArray(item.sourceUrls)) {
      await tx.delete(mediaUrls).where(eq(mediaUrls.mediaId, mediaId));
      for (const url of item.sourceUrls) {
        await tx.insert(mediaUrls).values({ mediaId, url });
      }
    }
  },
};
