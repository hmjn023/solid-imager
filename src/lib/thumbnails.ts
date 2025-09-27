import path from "node:path";
import { promises as fs } from "node:fs";
import sharp from "sharp";
import type { Media } from "~/db/schema";
import { getConfig } from "~/lib/api/config";

const CACHE_DIR = ".cache/thumbnails";

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function getThumbnailPath(mediaId: string): string {
  return path.join(CACHE_DIR, `${mediaId}.webp`);
}

/**
 * Generates a thumbnail for the given media item.
 * @param media - The media object from the database.
 * @param sourcePath - The absolute path of the media source directory.
 */
export async function generateThumbnail(
  media: Media,
  sourcePath: string,
): Promise<void> {
  await ensureCacheDir();

  const config = getConfig();
  const size = config.media?.image?.thumbnail?.size?.width ?? 512;
  const quality = config.media?.image?.thumbnail?.quality ?? 80;

  const inputPath = path.join(sourcePath, media.filePath);
  const outputPath = getThumbnailPath(media.id);

  try {
    await sharp(inputPath)
      .resize(size, size, { fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toFile(outputPath);
    console.log(`Generated thumbnail for ${media.fileName}`);
  } catch (error) {
    console.error(`Failed to generate thumbnail for ${inputPath}:`, error);
    // We throw the error to allow the caller (e.g., on-demand generation) to handle it.
    throw error;
  }
}

/**
 * Deletes a thumbnail file from the cache.
 * @param mediaId - The ID of the media whose thumbnail should be deleted.
 */
export async function deleteThumbnail(mediaId: string): Promise<void> {
  const thumbnailPath = getThumbnailPath(mediaId);
  try {
    await fs.unlink(thumbnailPath);
    console.log(`Deleted thumbnail for mediaId: ${mediaId}`);
  } catch (error: any) {
    // If the file doesn't exist, it's not an error in this context.
    if (error.code !== "ENOENT") {
      console.error(
        `Failed to delete thumbnail at ${thumbnailPath}:`,
        error,
      );
      throw error;
    }
  }
}
