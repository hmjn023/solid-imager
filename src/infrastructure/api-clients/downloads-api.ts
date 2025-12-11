/**
 * Downloads API Client
 * Handles download-related operations
 */

import type { DownloadItem } from "~/domain/media/schemas";
import { apiRequest } from "./shared/base-client";
import { API_ENDPOINTS } from "./shared/endpoints";

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
  return apiRequest(API_ENDPOINTS.downloads, null, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mediaSourceId,
      items,
    }),
  });
}
