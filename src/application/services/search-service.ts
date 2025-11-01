/**
 * SearchService - グローバル検索機能
 * Feature 7: メディアソート・検索機能
 */

/**
 * Defines the options available for searching media.
 * @property {string[]} [tags] - An array of tags to filter the search results.
 * @property {string} [sortBy] - The field to sort the search results by.
 * @property {number} [page] - The page number for pagination.
 * @property {number} [limit] - The maximum number of results per page.
 */
type SearchOptions = {
  tags?: string[];
  sortBy?: string;
  page?: number;
  limit?: number;
};
/**
 * Provides services for global media search functionalities.
 */
export const SearchService = {
  /**
   * Performs a global search for media across all configured sources.
   * @param {SearchOptions} _searchOptions - Options for filtering, sorting, and pagination.
   * @returns {any} A list of media items matching the search criteria.
   */
  globalSearchMedia(_searchOptions: SearchOptions) {
    // TODO: Search across all sources
    throw new Error("Not implemented");
  },
};
