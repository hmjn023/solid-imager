/// <reference types="bun-types" />
import fs from "node:fs/promises";
import path from "node:path";
import { initServices } from "../src/infrastructure/bootstrap";
import { db } from "../src/infrastructure/db";
import { medias } from "../src/infrastructure/db/schema";
import { generateThumbnail, getSourceCacheDir } from "../src/infrastructure/jobs/thumbnails";

// Simple concurrency helper
async function runWithLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
  onProgress?: (completed: number, total: number) => void,
) {
  let index = 0;
  let completed = 0;
  const total = items.length;

  const workers = Array.from({ length: limit }, async () => {
    while (index < total) {
      const currentIndex = index++;
      const item = items[currentIndex];
      try {
        await fn(item);
      } catch (err) {
        console.error(
          `\n❌ エラーが発生しました (インデックス ${currentIndex}, ID: ${(item as { id: string }).id}):`,
          err,
        );
      }
      completed++;
      if (onProgress) {
        onProgress(completed, total);
      }
    }
  });

  await Promise.all(workers);
}

async function main() {
  // Initialize configuration and registry services
  initServices();

  console.log("🔍 データベースからメディア一覧とソース情報を取得中...");
  const allMedia = await db
    .select({
      id: medias.id,
      mediaSourceId: medias.mediaSourceId,
      filePath: medias.filePath,
      fileName: medias.fileName,
    })
    .from(medias);

  console.log(`📦 データベース内のメディア数: ${allMedia.length}`);

  if (allMedia.length === 0) {
    console.log("⚠️ メディアが登録されていません。");
    return;
  }

  const sources = await db.query.mediaSources.findMany();
  const sourcePathMap = new Map<string, string>();
  for (const source of sources) {
    if (source.type === "local") {
      const basePath = (source.connectionInfo as { path?: string }).path;
      if (basePath) {
        sourcePathMap.set(source.id, basePath);
      }
    }
  }

  const sourceIds = [...new Set(allMedia.map((m) => m.mediaSourceId))];
  const existingThumbnailsBySource = new Map<string, Set<string>>();

  for (const sourceId of sourceIds) {
    const cacheDir = getSourceCacheDir(sourceId);
    try {
      const files = await fs.readdir(cacheDir);
      const ids = new Set(files.map((f) => path.basename(f, path.extname(f))));
      existingThumbnailsBySource.set(sourceId, ids);
    } catch {
      existingThumbnailsBySource.set(sourceId, new Set());
    }
  }

  const missingThumbnails: typeof allMedia = [];
  for (const media of allMedia) {
    const existingIds = existingThumbnailsBySource.get(media.mediaSourceId);
    if (!existingIds || !existingIds.has(media.id)) {
      missingThumbnails.push(media);
    }
  }

  console.log(`📊 照合結果: サムネイル未生成数: ${missingThumbnails.length}`);

  if (missingThumbnails.length === 0) {
    console.log("✅ すべてのサムネイルが正常に生成されています。再生成は不要です。");
    return;
  }

  console.log(`\n🚀 ${missingThumbnails.length} 件のサムネイルを再生成中 (並行数: 10)...`);

  await runWithLimit(
    missingThumbnails,
    10,
    async (media) => {
      const basePath = sourcePathMap.get(media.mediaSourceId);
      if (!basePath) {
        throw new Error(`ソースパスが見つかりません。SourceID: ${media.mediaSourceId}`);
      }
      await generateThumbnail(media, basePath, media.mediaSourceId);
    },
    (completed, total) => {
      if (completed % 10 === 0 || completed === total) {
        process.stdout.write(
          `⏳ 進捗: ${completed} / ${total} 件完了 (${Math.round((completed / total) * 100)}%)\r`,
        );
      }
    },
  );

  console.log("\n\n✅ サムネイルの再生成処理が完了しました！");
}

main().catch((err) => {
  console.error("❌ エラーが発生しました:", err);
  process.exit(1);
});
