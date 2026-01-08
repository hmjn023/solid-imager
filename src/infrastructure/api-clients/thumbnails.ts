/**
 * Thumbnails API Client
 *
 * NOTE: Migrated to use oRPC ✅
 */

import { orpc } from "~/infrastructure/api-clients/orpc-client";

/**
 * Starts thumbnail generation for a media source
 * @param mediaSourceId - The ID of the media source
 */
export function startThumbnailGeneration(mediaSourceId: string) {
  return orpc.thumbnails.generate({ sourceId: mediaSourceId });
}

/**
 * Clears thumbnail cache for a media source
 * @param mediaSourceId - The ID of the media source
 */
export function clearThumbnailCache(mediaSourceId: string) {
  return orpc.thumbnails.clear({ sourceId: mediaSourceId });
}
