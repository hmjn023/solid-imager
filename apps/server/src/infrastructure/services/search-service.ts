import {
	type ISearchService,
	createSearchService,
} from "@solid-imager/application/search";
/**
 * SearchService - Global Search Functionality
 * Feature 7: Media Sort/Search Functionality
 */

import { services } from "~/infrastructure/service-registry";

let _searchService: ISearchService | null = null;

export const resetSearchService = () => {
	_searchService = null;
};

const getSearchService = () => {
	if (!_searchService) {
		_searchService = createSearchService(services.getMediaRepository());
	}
	return _searchService;
};

export const SearchService = new Proxy({} as ISearchService, {
	get(_target, prop) {
		const service = getSearchService();
		const value = service[prop as keyof ISearchService];
		return typeof value === "function" ? value.bind(service) : value;
	},
});
