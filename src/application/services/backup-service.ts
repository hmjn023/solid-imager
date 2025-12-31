import { Buffer } from "node:buffer";
import fs from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { Open } from "unzipper";
import { db, type TransactionClient } from "~/infrastructure/db";
import {
  authors,
  mediaAuthors,
  mediaGenerationInfo,
  mediaSources,
  medias,
  mediaTags,
  mediaUrls,
  tags,
} from "~/infrastructure/db/schema";
import { getDriver } from "~/infrastructure/storage/factory";

/**
 * Service for handling media source backups, restoration, and imports.
 */
// biome-ignore lint/suspicious/noExplicitAny: Complex structure from external dump
export const BackupService = {
  /**
   * Restores media metadata from a JSON dump.
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

    const connectionInfo = mediaSource.connectionInfo as { path: string };
    const basePath = connectionInfo.path;
    const isLocal = mediaSource.type === "local";

    let processedCount = 0;
    let skippedCount = 0;
    const errorMessages: string[] = [];

    for (const item of items) {
      try {
        const result = await this.processRestoreItem(
          mediaSourceId,
          item,
          isLocal,
          basePath
        );
        if (result === "skipped") {
          skippedCount++;
        } else {
          processedCount++;
        }
      } catch (err) {
        errorMessages.push(
          `Failed to restore ${item.filePath}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return {
      processed: processedCount,
      skipped: skippedCount,
      errors: errorMessages,
    };
  },

  /**
   * Imports media data from a ZIP file.
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Legacy import logic
  async importSourceZip(mediaSourceId: string, file: File) {
    const mediaSource = await db.query.mediaSources.findFirst({
      where: eq(mediaSources.id, mediaSourceId),
    });

    if (!mediaSource) {
      throw new Error("Media source not found");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const directory = await Open.buffer(buffer);

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

  // Helper methods for Restore
  // biome-ignore lint/suspicious/noExplicitAny: complex item structure
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

  // Helper methods for Import
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Legacy import logic
  // biome-ignore lint/suspicious/noExplicitAny: complex item structure
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
