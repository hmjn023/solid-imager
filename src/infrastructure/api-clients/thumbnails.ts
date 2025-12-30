/**
 * Thumbnails API Client
 * Handles all API calls related to thumbnails
 */

import { z } from "zod";
import { apiRequest } from "./shared/base-client";
import { API_ENDPOINTS } from "./shared/endpoints";

/**
 * Starts thumbnail generation for a media source
 * @param mediaSourceId - The ID of the media source
 */
export function startThumbnailGeneration(mediaSourceId: string) {
  // Assuming the API returns accepted (202) or success (200) with minimal body
  return apiRequest(
    API_ENDPOINTS.thumbnailGenerate(mediaSourceId),
    z.unknown(),
    {
      method: "POST",
    }
  );
}

/**
 * Clears thumbnail cache for a media source
 * @param mediaSourceId - The ID of the media source
 */
export function clearThumbnailCache(mediaSourceId: string) {
  return apiRequest(API_ENDPOINTS.thumbnailClear(mediaSourceId), z.unknown(), {
    method: "POST",
  });
}
