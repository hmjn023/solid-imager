import { eq } from "drizzle-orm";
import { db } from "~/infrastructure/db";
import { mediaSources, medias } from "~/infrastructure/db/schema";
import { getDriver } from "~/infrastructure/storage/factory";

const _IMAGES_PREFIX = /^images\//;

/**
 * Service for handling media source backups, restoration, and imports.
 */
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
  } /**
   * Imports media data from a ZIP file path.
   */,
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
};
