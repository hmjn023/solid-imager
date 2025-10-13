import {
  clearThumbnailCache as apiClearThumbnailCache,
  startThumbnailGeneration as apiStartThumbnailGeneration,
} from "../../infrastructure/api-clients/thumbnails";

/**
 * ThumbnailService - サムネイル生成・管理機能
 * Feature 2: メディア配信・サムネイル作成機能
 */

export const ThumbnailService = {
  // Feature 2: サムネイル仕様
  getAllThumbnailLinks(sourceId: string): Promise<string[]> {
    // TODO: This is a placeholder. Actual implementation needs to fetch all media IDs for the source.
    return [`/api/thumbnails/${sourceId}/all`];
  },

  getMediaThumbnail(
    sourceId: string,
    mediaId: string,
    size?: number
  ): Promise<string> {
    let url = `/api/thumbnails/${sourceId}/${mediaId}`;
    if (size) {
      url += `?size=${size}`;
    }
    return url;
  },

  startThumbnailGeneration(sourceId: string) {
    return apiStartThumbnailGeneration(sourceId);
  },

  clearThumbnailCache(sourceId: string) {
    return apiClearThumbnailCache(sourceId);
  },
};
