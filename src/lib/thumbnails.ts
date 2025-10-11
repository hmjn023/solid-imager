import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { selectMediaSourceById, selectMediasByMediaSourceId } from "~/db";
import type { Media } from "~/db/schema";
import { getConfig } from "~/lib/api/config";
import { addJobsToQueue, startJobQueue } from "~/services/thumbnail-jobs";

const CACHE_DIR = ".cache/thumbnails";

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function getThumbnailPath(mediaId: string): string {
  return path.join(CACHE_DIR, `${mediaId}.webp`);
}

/**
 * 指定されたメディアアイテムのサムネイルを生成します。
 * @param media - データベースからのメディアオブジェクト。
 * @param sourcePath - メディアソースディレクトリの絶対パス。
 */
export async function generateThumbnail(
  media: Media,
  sourcePath: string
): Promise<void> {
  await ensureCacheDir();

  const config = getConfig();
  const size = config.media?.image?.thumbnail?.size?.width ?? 512;
  const quality = config.media?.image?.thumbnail?.quality ?? 80;

  const inputPath = path.join(sourcePath, media.filePath);
  const outputPath = getThumbnailPath(media.id);
  await sharp(inputPath)
    .resize(size, size, { fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toFile(outputPath);
}

/**
 * キャッシュからサムネイルファイルを削除します。
 * @param mediaId - サムネイルを削除するメディアのID。
 */
export async function deleteThumbnail(mediaId: string): Promise<void> {
  const thumbnailPath = getThumbnailPath(mediaId);
  try {
    await fs.unlink(thumbnailPath);
  } catch (error: any) {
    // ファイルが存在しない場合、このコンテキストではエラーではありません。
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

/**
 * 指定されたソースのすべてのメディアをサムネイル生成のためにキューに入れます。
 * @param sourceId - メディアソースのID。
 */
export async function generateThumbnailsForSource(
  sourceId: string
): Promise<number> {
  const sources = await selectMediaSourceById(sourceId);
  if (sources.length === 0 || sources[0].type !== "local") {
    throw new Error("Source not found or not a local source");
  }
  const source = sources[0];

  const mediaItems = await selectMediasByMediaSourceId(sourceId);
  if (mediaItems.length === 0) {
    return 0;
  }

  const jobs = mediaItems.map((media) => ({
    mediaId: media.id,
    sourcePath: source.connectionInfo.path,
  }));

  addJobsToQueue(sourceId, jobs);
  startJobQueue(sourceId, async (job) => {
    const media = mediaItems.find((m) => m.id === job.mediaId);
    if (media) {
      await generateThumbnail(media, job.sourcePath);
    }
  });

  return jobs.length;
}
