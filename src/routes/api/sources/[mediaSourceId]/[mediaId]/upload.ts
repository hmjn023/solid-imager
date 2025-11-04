import type { APIEvent } from "@solidjs/start/server";
import { uploadMedia } from "~/infrastructure/api-clients/media";

/**
 * メディアをアップロードします。
 *
 * @param param0 {mediaSourceId: UUID, mediaId: UUID}
 * @returns アップロード結果
 */
export async function POST({ params, request }: APIEvent) {
  const mediaSourceId = params.mediaSourceId;
  const mediaId = params.mediaId;
  // For placeholder, assuming path and file are in request body for simplicity
  const uploadData = await request.json();
  const result = await uploadMedia(mediaSourceId, { mediaId, ...uploadData });
  return result;
}
