import { startThumbnailGeneration as apiStartThumbnailGeneration, clearThumbnailCache as apiClearThumbnailCache } from "../../infrastructure/api-clients/thumbnails";

/**
 * ThumbnailService - サムネイル生成・管理機能
 * Feature 2: メディア配信・サムネイル作成機能
 */

export const ThumbnailService = {
  // Feature 2: サムネイル仕様
  async getAllThumbnailLinks(sourceId: string): Promise<string[]> {
    // TODO: This is a placeholder. Actual implementation needs to fetch all media IDs for the source.
    return [`/api/thumbnails/${sourceId}/all`];
  },

  async getMediaThumbnail(sourceId: string, mediaId: string, size?: number): Promise<string> {
    let url = `/api/thumbnails/${sourceId}/${mediaId}`;
    if (size) {
      url += `?size=${size}`;
    }
    return url;
  },

  async startThumbnailGeneration(sourceId: string) {
    return apiStartThumbnailGeneration(sourceId);
  },

  async clearThumbnailCache(sourceId: string) {
    return apiClearThumbnailCache(sourceId);
  },
