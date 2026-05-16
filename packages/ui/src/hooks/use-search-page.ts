import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type {
	Author,
	MediaSearchRequest,
	MediaSearchResponse,
} from "@solid-imager/core/domain/media/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import type { TagResponse } from "@solid-imager/core/domain/tags/schemas";
import type { QueryClient } from "@tanstack/solid-query";
import {
	createInfiniteQuery,
	createQuery,
	keepPreviousData,
} from "@tanstack/solid-query";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
import type { buildAuthorsQueryOptions } from "../query-options/authors-query";
import type { buildCharactersQueryOptions } from "../query-options/characters-query";
import type { buildIpsQueryOptions } from "../query-options/ips-query";
import type { buildProjectsQueryOptions } from "../query-options/projects-query";
import type { buildSourcesQueryOptions } from "../query-options/sources-query";
import type { buildTagsQueryOptions } from "../query-options/tags-query";

const DEFAULT_GC_TIME = 1000 * 60 * 5;
const DEFAULT_REFRESH_DEBOUNCE_MS = 0;

export type SearchPageFilterData = {
	tags: TagResponse[] | undefined;
	projects: Project[] | undefined;
	ips: Ip[] | undefined;
	characters: Character[] | undefined;
	authors: Author[] | undefined;
};

export type SearchPageQueryOptions = {
	tags: () => ReturnType<typeof buildTagsQueryOptions>;
	sources: () => ReturnType<typeof buildSourcesQueryOptions>;
	projects: () => ReturnType<typeof buildProjectsQueryOptions>;
	ips: () => ReturnType<typeof buildIpsQueryOptions>;
	characters: () => ReturnType<typeof buildCharactersQueryOptions>;
	authors: () => ReturnType<typeof buildAuthorsQueryOptions>;
};

export interface UseSearchPageOptions {
	searchMedia: (
		sourceId: string | undefined,
		params: MediaSearchRequest,
	) => Promise<MediaSearchResponse>;
	queryClient: QueryClient;
	queries: SearchPageQueryOptions;
	selectedSource: () => string | null | undefined;
	getSearchCondition: () => MediaSearchRequest["condition"];
	sortBy: () => MediaSearchRequest["sort"];
	sortOrder: () => "asc" | "desc";
	limit: () => number;
	scrollY: () => number;
	setScrollY: (y: number) => void;
	setOffset: (o: number) => void;
	gcTime?: number;
	refreshDebounceMs?: number;
}

export interface UseSearchPageResult {
	searchResultQuery: ReturnType<
		typeof createInfiniteQuery<MediaSearchResponse>
	>;
	searchResults: () => MediaSearchResponse["media"];
	filterData: SearchPageFilterData;
	sources: () => SafeMediaSource[] | undefined;
	getSourceRootPath: (mediaSourceId: string) => string | undefined;
	isRestored: () => boolean;
	handleSearch: () => void;
	refreshSearchResults: () => void;
	loadMoreRef: () => HTMLDivElement | undefined;
	setLoadMoreRef: (el: HTMLDivElement | undefined) => void;
	conditionKey: () => string;
}

export function useSearchPage(
	options: UseSearchPageOptions,
): UseSearchPageResult {
	const {
		searchMedia,
		queryClient,
		queries,
		selectedSource,
		getSearchCondition,
		sortBy,
		sortOrder,
		limit,
		scrollY,
		setScrollY,
		setOffset,
		gcTime = DEFAULT_GC_TIME,
		refreshDebounceMs = DEFAULT_REFRESH_DEBOUNCE_MS,
	} = options;

	const tags = createQuery(() => queries.tags());
	const sources = createQuery(() => queries.sources());
	const allProjects = createQuery(() => queries.projects());
	const allIps = createQuery(() => queries.ips());
	const allCharacters = createQuery(() => queries.characters());
	const allAuthors = createQuery(() => queries.authors());

	const conditionKey = createMemo(() => {
		const val = getSearchCondition() ?? null;
		if (val === null || typeof val !== "object") {
			return JSON.stringify(val);
		}
		return JSON.stringify(val, Object.keys(val).sort());
	});

	const buildSearchParams = (): Pick<
		MediaSearchRequest,
		"condition" | "sort" | "order" | "limit"
	> => {
		const condition = getSearchCondition();
		return {
			condition: condition || undefined,
			sort: sortBy(),
			order: sortOrder(),
			limit: limit(),
		};
	};

	const searchResultQuery = createInfiniteQuery<MediaSearchResponse>(() => {
		const params = buildSearchParams();
		const source = selectedSource() || undefined;
		return {
			queryKey: [
				"searchResults",
				source,
				conditionKey(),
				sortBy(),
				sortOrder(),
				limit(),
			],
			queryFn: async ({ pageParam }) =>
				await searchMedia(source, {
					...params,
					offset: pageParam as number,
				}),
			initialPageParam: 0,
			getNextPageParam: (lastPage, allPages) => {
				const loadedCount = allPages.reduce(
					(sum, page) => sum + page.media.length,
					0,
				);
				if (loadedCount < lastPage.total) {
					return loadedCount;
				}
			},
			placeholderData: keepPreviousData,
			gcTime,
		};
	});

	const searchResults = createMemo(() => {
		const seen = new Set<string>();
		return (searchResultQuery.data?.pages.flatMap((p) => p.media) || []).filter(
			(m) => {
				if (seen.has(m.id)) {
					return false;
				}
				seen.add(m.id);
				return true;
			},
		);
	});

	const getSourceRootPath = (mediaSourceId: string) => {
		const source = sources.data?.find((item) => item.id === mediaSourceId);
		if (source?.type !== "local") {
			return undefined;
		}
		const connectionInfo = source.connectionInfo as { path?: string };
		return connectionInfo.path;
	};

	const [refreshTimer, setRefreshTimer] = createSignal<ReturnType<
		typeof setTimeout
	> | null>(null);

	const refreshSearchResults = () => {
		const timer = refreshTimer();
		if (timer) {
			clearTimeout(timer);
		}
		if (refreshDebounceMs <= 0) {
			void queryClient.invalidateQueries({ queryKey: ["searchResults"] });
			setRefreshTimer(null);
			return;
		}
		setRefreshTimer(
			setTimeout(() => {
				void queryClient.invalidateQueries({ queryKey: ["searchResults"] });
				setRefreshTimer(null);
			}, refreshDebounceMs),
		);
	};

	const [isRestored, setIsRestored] = createSignal(false);

	createEffect(() => {
		if (
			!(searchResultQuery.isLoading || isRestored()) &&
			searchResultQuery.data &&
			searchResultQuery.data.pages.length > 0
		) {
			if (scrollY() > 0) {
				requestAnimationFrame(() => {
					window.scrollTo(0, scrollY());
				});
			}
			setIsRestored(true);
		}
	});

	onCleanup(() => {
		if (!isServer) {
			setScrollY(window.scrollY);
		}
		const timer = refreshTimer();
		if (timer) {
			clearTimeout(timer);
		}
	});

	const handleSearch = () => {
		setOffset(0);
		setScrollY(0);
		window.scrollTo(0, 0);
	};

	const [loadMoreRef, setLoadMoreRef] = createSignal<
		HTMLDivElement | undefined
	>(undefined);

	createEffect(() => {
		const el = loadMoreRef();
		if (!el) {
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (
					entries[0].isIntersecting &&
					searchResultQuery.hasNextPage &&
					!searchResultQuery.isFetchingNextPage
				) {
					searchResultQuery.fetchNextPage();
				}
			},
			{ threshold: 0.5, rootMargin: "1000px" },
		);
		observer.observe(el);
		onCleanup(() => observer.disconnect());
	});

	return {
		searchResultQuery,
		searchResults,
		filterData: {
			get tags() {
				return tags.data;
			},
			get projects() {
				return allProjects.data;
			},
			get ips() {
				return allIps.data;
			},
			get characters() {
				return allCharacters.data;
			},
			get authors() {
				return allAuthors.data;
			},
		},
		sources: () => sources.data,
		getSourceRootPath,
		isRestored,
		handleSearch,
		refreshSearchResults,
		loadMoreRef,
		setLoadMoreRef,
		conditionKey,
	};
}
