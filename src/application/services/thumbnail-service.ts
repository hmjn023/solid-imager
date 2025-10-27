import {
  clearThumbnailCache as apiClearThumbnailCache,
  startThumbnailGeneration as apiStartThumbnailGeneration,
} from "~/infrastructure/api-clients/thumbnails";

/**
 * Provides services for managing thumbnail generation and retrieval.
 */
export const ThumbnailService = {
  /**
   * Constructs the URL for a specific media thumbnail.
   * @param {string} sourceId - The ID of the media source.
   * @param {string} mediaId - The ID of the media item.
   * @param {number} [size] - The desired size of the thumbnail.
   * @returns {string} The URL of the thumbnail.
   */
  getMediaThumbnailUrl(
    sourceId: string,
    mediaId: string,
    size?: number
  ): string {
    let url = `/api/sources/${sourceId}/${mediaId}/thumbnail`;
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
