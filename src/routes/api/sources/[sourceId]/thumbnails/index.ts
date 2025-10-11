import type { APIEvent } from "@solidjs/start/server";
import {
  clearThumbnailCache,
  startThumbnailGeneration,
} from "~/lib/api/thumbnails";
import type { UUID } from "~/lib/types";

/**
 * 手動でサムネイル生成を開始します。
 *
 * @param param0 {sourceId: UUID}
 * @returns 生成開始結果
 */
export async function POST({ params }: APIEvent) {
  const sourceId = params.sourceId as UUID;
  const result = await startThumbnailGeneration(sourceId);
  return result;
}

/**
 * サムネイルキャッシュをクリアします。
 *
 * @param param0 {sourceId: UUID}
 * @returns キャッシュクリア結果
 */
export async function DELETE({ params }: APIEvent) {
  const sourceId = params.sourceId as UUID;
  const result = await clearThumbnailCache(sourceId);
  return result;
}
