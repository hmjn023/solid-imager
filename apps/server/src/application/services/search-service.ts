/**
 * SearchService - Global Search Functionality
 * Feature 7: Media Sort/Search Functionality
 */

import { SearchServiceImpl } from "@solid-imager/application/services/search-service";
import { services } from "~/application/registry";

type SearchOptions = {
	tags?: string[];
	sortBy?: string;
	order?: "asc" | "desc";
	page?: number;
	limit?: number;
};

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
