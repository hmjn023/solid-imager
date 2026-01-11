/**
 * SearchService - Global Search Functionality
 * Feature 7: Media Sort/Search Functionality
 */

import { services } from "~/application/registry";
import type {
  MediaSearchRequest,
  MediaSearchResponse,
} from "~/domain/media/schemas";
import type { IMediaRepository } from "~/domain/repositories/media-repository";

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
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
};

const DEFAULT_PAGE_LIMIT = 20;

export class SearchServiceImpl {
  private readonly mediaRepository: IMediaRepository;

  constructor(mediaRepository: IMediaRepository) {
    this.mediaRepository = mediaRepository;
  }

  /**
   * Performs a global search for media across all configured sources.
   * @param {SearchOptions} searchOptions - Options for filtering, sorting, and pagination.
   * @returns {Promise<MediaSearchResponse>} A list of media items matching the search criteria.
   */
  async globalSearchMedia(
    searchOptions: SearchOptions
  ): Promise<MediaSearchResponse> {
    const limit = searchOptions.limit || DEFAULT_PAGE_LIMIT;
    const offset = searchOptions.page ? (searchOptions.page - 1) * limit : 0;

    let sort: "date" | "name" | "size";
    switch (searchOptions.sortBy) {
      case "name":
      case "size":
        sort = searchOptions.sortBy;
        break;
      default:
        sort = "date";
    }

    const request: MediaSearchRequest = {
      tags: searchOptions.tags?.join(",") || undefined,
      sort,
      order: searchOptions.order || "desc",
      limit,
      offset,
    };

    return await this.mediaRepository.globalSearch(request);
  }
}

// Singleton handling similar to MediaService to avoid circular dependency issues during initialization if any
let _searchService: SearchServiceImpl | null = null;

export const resetSearchService = () => {
  _searchService = null;
};

const getSearchService = () => {
  if (!_searchService) {
    _searchService = new SearchServiceImpl(services.getMediaRepository());
  }
  return _searchService;
};

export const SearchService = new Proxy({} as SearchServiceImpl, {
  get(_target, prop) {
    const service = getSearchService();
    const value = service[prop as keyof SearchServiceImpl];
    return typeof value === "function" ? value.bind(service) : value;
  },
});
