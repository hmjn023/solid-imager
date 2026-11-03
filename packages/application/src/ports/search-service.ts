import type {
	MediaSearchRequest,
	MediaSearchResponse,
} from "@solid-imager/core/domain/media/schemas";

/** Filters and pagination used by global media search. */
export type SearchOptions = {
	tags?: string[];
	sortBy?: MediaSearchRequest["sort"];
	order?: "asc" | "desc";
	page?: number;
	limit?: number;
};

/** Searches media across sources using the supplied filters and pagination. */
export interface ISearchService {
	globalSearchMedia(options: SearchOptions): Promise<MediaSearchResponse>;
}
