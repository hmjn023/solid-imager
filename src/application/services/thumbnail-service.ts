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
   * @param {string} mediaSourceId - The ID of the media source.
   * @param {string} mediaId - The ID of the media item.
   * @param {number} [size] - The desired size of the thumbnail.
   * @returns {string} The URL of the thumbnail.
   */
  getMediaThumbnailUrl(
    mediaSourceId: string,
    mediaId: string,
    size?: number
  ): string {
    let url = `/api/sources/${mediaSourceId}/${mediaId}/thumbnail`;
    if (size) {
      url += `?size=${size}`;
    }
    return url;
  },

  /**
   * Initiates the manual generation of thumbnails for a specific media source.
   * @param {string} mediaSourceId - The ID of the media source.
   * @returns {Promise<any>} A promise that resolves when the generation process starts.
   */
  startThumbnailGeneration(mediaSourceId: string) {
    return apiStartThumbnailGeneration(mediaSourceId);
  },

  /**
   * Clears the thumbnail cache for a specific media source.
   * @param {string} mediaSourceId - The ID of the media source.
   * @returns {Promise<any>} A promise that resolves when the cache has been cleared.
   */
  clearThumbnailCache(mediaSourceId: string) {
    return apiClearThumbnailCache(mediaSourceId);
  },
};
