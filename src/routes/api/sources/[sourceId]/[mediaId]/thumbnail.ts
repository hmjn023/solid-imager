import type { APIEvent } from "@solidjs/start/server";
import { getMediaThumbnail } from "~/lib/api/media";
import type { UUID } from "~/lib/utils";

/**
 *
 * @param param0 {sourceId: UUID, mediaId: UUID}
 * @returns メディアとのサムネイル
 */
export async function GET({ params }: APIEvent) {
  const sourceId = params.sourceId as UUID;
  const mediaId = params.mediaId as UUID;
  const thumbnail = await getMediaThumbnail(sourceId, mediaId);
  return thumbnail;
}
