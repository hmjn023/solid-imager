/**
 * ThumbnailService - サムネイル生成・管理機能
 * Feature 2: メディア配信・サムネイル作成機能
 */

export const ThumbnailService = {
  // Feature 2: サムネイル仕様
  async getAllThumbnailLinks(_sourceId: string) {
    // TODO: Get all thumbnail links for a source
    throw new Error("Not implemented");
  },

  async getMediaThumbnail(_sourceId: string, _mediaId: string, _size?: number) {
    // TODO: Get thumbnail for specific media with optional size parameter
    throw new Error("Not implemented");
  },

  async startThumbnailGeneration(_sourceId: string) {
    // TODO: Start thumbnail generation for all media in source
    throw new Error("Not implemented");
  },

  async clearThumbnailCache(_sourceId: string) {
    // TODO: Clear thumbnail cache for source
    throw new Error("Not implemented");
  },
};
