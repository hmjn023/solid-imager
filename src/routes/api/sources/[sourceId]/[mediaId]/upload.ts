import type { APIEvent } from "@solidjs/start/server";
import { uploadMedia } from "~/lib/api/media";
import type { UUID } from "~/lib/types";

/**
 * メディアをアップロードします。
 *
 * @param param0 {sourceId: UUID, mediaId: UUID}
 * @returns アップロード結果
 */
export async function POST({ params, request }: APIEvent) {
  const sourceId = params.sourceId as UUID;
  const mediaId = params.mediaId as UUID;
  // For placeholder, assuming path and file are in request body for simplicity
  const uploadData = await request.json();
  const result = await uploadMedia(sourceId, { mediaId, ...uploadData });
  return result;
}
