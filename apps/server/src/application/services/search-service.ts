import {
	createSearchService,
	SearchServiceImpl,
} from "@solid-imager/application/services/search-service";
import { services } from "~/application/registry";

export { SearchServiceImpl };

// Singleton handling similar to MediaService to avoid circular dependency issues during initialization if any
let _searchService: SearchServiceImpl | null = null;

export const resetSearchService = () => {
	_searchService = null;
};

const getSearchService = () => {
	if (!_searchService) {
		_searchService = createSearchService(services.getMediaRepository());
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
