/**
 * SearchService - グローバル検索機能
 * Feature 7: メディアソート・検索機能
 */

type SearchOptions = {
  tags?: string[];
  sortBy?: string;
  page?: number;
  limit?: number;
};

export const SearchService = {
  // Feature 7: グローバル検索
  async globalSearchMedia(_searchOptions: SearchOptions) {
    // TODO: Search across all sources
    throw new Error("Not implemented");
  },
};
