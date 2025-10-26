import {
  clearThumbnailCache as apiClearThumbnailCache,
  startThumbnailGeneration as apiStartThumbnailGeneration,
} from "../../infrastructure/api-clients/thumbnails";

/**
 * ThumbnailService - サムネイル生成・管理機能
 * Feature 2: メディア配信・サムネイル作成機能
 */

/**
 * Provides services for managing thumbnail generation and retrieval.
 */
export const ThumbnailService = {
  /**
   * Retrieves all thumbnail links for a given media source.
   * This is a placeholder and needs actual implementation to fetch all media IDs.
   * @param {string} sourceId - The ID of the media source.
   * @returns {Promise<string[]>} A promise that resolves with an array of thumbnail URLs.
   */
  getAllThumbnailLinks(sourceId: string): Promise<string[]> {
    // TODO: This is a placeholder. Actual implementation needs to fetch all media IDs for the source.
    return [`/api/thumbnails/${sourceId}/all`];
  },

  /**
   * Constructs the URL for a specific media thumbnail.
   * @param {string} sourceId - The ID of the media source.
   * @param {string} mediaId - The ID of the media item.
   * @param {number} [size] - The desired size of the thumbnail.
   * @returns {Promise<string>} A promise that resolves with the URL of the thumbnail.
   */
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

  /**
   * Initiates the manual generation of thumbnails for a specific media source.
   * @param {string} sourceId - The ID of the media source.
   * @returns {Promise<any>} A promise that resolves when the generation process starts.
   */
  startThumbnailGeneration(sourceId: string) {
    return apiStartThumbnailGeneration(sourceId);
  },

  /**
   * Clears the thumbnail cache for a specific media source.
   * @param {string} sourceId - The ID of the media source.
   * @returns {Promise<any>} A promise that resolves when the cache has been cleared.
   */
  clearThumbnailCache(sourceId: string) {
    return apiClearThumbnailCache(sourceId);
  },
};
