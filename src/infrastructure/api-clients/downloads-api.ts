/**
 * Downloads API Client
 *
 * NOTE: Migrated to use oRPC ✅
 */

import type { DownloadItem } from "~/domain/media/schemas";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

/**
 * Starts a download job
 * @param mediaSourceId - The ID of the media source
 * @param items - The items to download
 * @returns The response from the download API
 */
export function startDownloadJobs(
  mediaSourceId: string,
  items: DownloadItem[]
) {
  return orpc.downloads.start({
    mediaSourceId,
    items,
  });
}
