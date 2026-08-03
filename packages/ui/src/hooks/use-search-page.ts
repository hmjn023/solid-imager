import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type {
	Author,
	MediaSearchRequest,
	MediaSearchResponse,
	SimilarMediaSearchResponse,
} from "@solid-imager/core/domain/media/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import type { TagResponse } from "@solid-imager/core/domain/tags/schemas";
import {
	createInfiniteQuery,
	createQuery,
	type InfiniteData,
	useQueryClient,
} from "@tanstack/solid-query";
import {
	type Accessor,
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
} from "solid-js";
import { isServer } from "solid-js/web";
import { buildSearchResultsQueryOptions } from "../query-options";
import { type QueryUiState, toQueryUiState } from "../query-state";
import { scrollToPosition, useScrollRestoration } from "./scroll-container";

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
	// biome-ignore lint/suspicious/noExplicitAny: oRPC query option factories do not satisfy Solid Query's overloaded public type
	tags: () => any;
	// biome-ignore lint/suspicious/noExplicitAny: oRPC query option factories do not satisfy Solid Query's overloaded public type
	sources: () => any;
	// biome-ignore lint/suspicious/noExplicitAny: oRPC query option factories do not satisfy Solid Query's overloaded public type
	projects: () => any;
	// biome-ignore lint/suspicious/noExplicitAny: oRPC query option factories do not satisfy Solid Query's overloaded public type
	ips: () => any;
	// biome-ignore lint/suspicious/noExplicitAny: oRPC query option factories do not satisfy Solid Query's overloaded public type
	characters: () => any;
	// biome-ignore lint/suspicious/noExplicitAny: oRPC query option factories do not satisfy Solid Query's overloaded public type
	authors: () => any;
};

export interface UseSearchPageOptions {
	searchMedia: (
		sourceId: string | undefined,
		params: MediaSearchRequest,
		signal?: AbortSignal,
	) => Promise<MediaSearchResponse>;
	searchSimilar?: (
		input: {
			anchorMediaId: string;
			mediaSourceId?: string;
			topK: number;
		},
		signal?: AbortSignal,
	) => Promise<SimilarMediaSearchResponse>;
	queries: SearchPageQueryOptions;
	selectedSource: () => string | null | undefined;
	getSearchCondition: () => MediaSearchRequest["condition"];
	sortBy: () => MediaSearchRequest["sort"];
	sortOrder: () => "asc" | "desc";
	limit: () => number;
	scrollY: () => number;
	setScrollY: (y: number) => void;
	setOffset: (o: number) => void;
	mode?: () => "simple" | "pro" | "vector";
	similarityAnchorMediaId?: () => string | null;
	similarityTopK?: () => number;
	gcTime?: number;
	refreshDebounceMs?: number;
	isSearchStateRestored?: Accessor<boolean>;
	scrollContainerSelector?: string;
}

export interface UseSearchPageResult {
	searchResultQuery: ReturnType<
		typeof createInfiniteQuery<MediaSearchResponse>
	>;
	searchResults: () => MediaSearchResponse["media"];
	hasData: () => boolean;
	totalCount: () => number | undefined;
	contentState: () => QueryUiState<MediaSearchResponse["media"]>;
	filterStates: {
		tags: () => QueryUiState<TagResponse[]>;
		sources: () => QueryUiState<SafeMediaSource[]>;
		projects: () => QueryUiState<Project[]>;
		ips: () => QueryUiState<Ip[]>;
		characters: () => QueryUiState<Character[]>;
		authors: () => QueryUiState<Author[]>;
	};
	filterData: SearchPageFilterData;
	sources: () => SafeMediaSource[] | undefined;
	getSourceRootPath: (mediaSourceId: string) => string | undefined;
	isRestored: () => boolean;
	handleSearch: () => void;
	retryFilters: () => Promise<void>;
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
		queries,
		selectedSource,
		getSearchCondition,
		sortBy,
		sortOrder,
		limit,
		scrollY,
		setScrollY,
		setOffset,
		mode = () => "simple",
		similarityAnchorMediaId = () => null,
		similarityTopK = () => 50,
		gcTime = DEFAULT_GC_TIME,
		refreshDebounceMs = DEFAULT_REFRESH_DEBOUNCE_MS,
		isSearchStateRestored = () => true,
	} = options;

	const tags = createQuery<TagResponse[]>(() => ({
		...queries.tags(),
		enabled: !isServer,
	}));
	const sources = createQuery<SafeMediaSource[]>(() => ({
		...queries.sources(),
		enabled: !isServer,
	}));
	const allProjects = createQuery<Project[]>(() => ({
		...queries.projects(),
		enabled: !isServer,
	}));
	const allIps = createQuery<Ip[]>(() => ({
		...queries.ips(),
		enabled: !isServer,
	}));
	const allCharacters = createQuery<Character[]>(() => ({
		...queries.characters(),
		enabled: !isServer,
	}));
	const allAuthors = createQuery<Author[]>(() => ({
		...queries.authors(),
		enabled: !isServer,
	}));

	const conditionKey = createMemo(() =>
		JSON.stringify(getSearchCondition() ?? null),
	);

	const searchResultQueryOptions = createMemo(() =>
		buildSearchResultsQueryOptions({
			mode: mode(),
			sourceId: selectedSource() || undefined,
			condition: getSearchCondition(),
			conditionKey: conditionKey(),
			sort: sortBy(),
			order: sortOrder(),
			limit: limit(),
			similarityAnchorMediaId: similarityAnchorMediaId(),
			similarityTopK: similarityTopK(),
			searchMedia,
			searchSimilar: options.searchSimilar,
			enabled: !isServer && isSearchStateRestored(),
			gcTime,
		}),
	);
	const searchResultQuery = createInfiniteQuery(searchResultQueryOptions);
	const queryClient = useQueryClient();
	const [searchResultData, setSearchResultData] = createSignal<
		InfiniteData<MediaSearchResponse> | undefined
	>();

	createEffect(() => {
		// Solid Query exposes `data` as a resource-backed accessor. During an
		// infinite-page fetch it can suspend even when previous pages are cached;
		// keep the rendered result in a regular signal so the collection DOM stays
		// mounted while the next page is loading.
		const queryKey = searchResultQueryOptions().queryKey;
		searchResultQuery.dataUpdatedAt;
		const cachedData =
			queryClient.getQueryData<InfiniteData<MediaSearchResponse>>(queryKey);
		if (cachedData !== undefined) {
			setSearchResultData(cachedData);
		} else if (!searchResultQuery.isPlaceholderData) {
			setSearchResultData(undefined);
		}
	});

	const searchResults = createMemo(() => {
		const seen = new Set<string>();
		return (searchResultData()?.pages.flatMap((p) => p.media) || []).filter(
			(m) => {
				if (seen.has(m.id)) {
					return false;
				}
				seen.add(m.id);
				return true;
			},
		);
	});
	const contentState = () =>
		toQueryUiState(
			{
				data: searchResultData() ? searchResults() : undefined,
				error: searchResultQuery.error,
				status: searchResultQuery.status,
				fetchStatus: searchResultQuery.fetchStatus,
			},
			{ isEmpty: (data) => data.length === 0 },
		);
	const arrayState = <T>(query: {
		data: T[] | undefined;
		error: unknown;
		status: "pending" | "error" | "success";
		fetchStatus: "idle" | "fetching" | "paused";
	}) => toQueryUiState(query, { isEmpty: (data) => data.length === 0 });
	const retryFilters = async () => {
		await Promise.all([
			tags.refetch(),
			sources.refetch(),
			allProjects.refetch(),
			allIps.refetch(),
			allCharacters.refetch(),
			allAuthors.refetch(),
		]);
	};

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
			// Refetching the observer targets its current exact query key. Do not
			// invalidate cached results for other sources, modes, or conditions.
			void searchResultQuery.refetch();
			setRefreshTimer(null);
			return;
		}
		setRefreshTimer(
			setTimeout(() => {
				void searchResultQuery.refetch();
				setRefreshTimer(null);
			}, refreshDebounceMs),
		);
	};

	const isRestored = useScrollRestoration({
		restoreKey: () => "search",
		getPosition: () => scrollY(),
		setPosition: (key, position) => {
			void key;
			setScrollY(position);
		},
		isReady: () => Boolean(searchResultData()) && !searchResultQuery.isLoading,
		hasNextPage: () => searchResultQuery.hasNextPage,
		isFetchingNextPage: () => searchResultQuery.isFetchingNextPage,
		fetchNextPage: () => searchResultQuery.fetchNextPage(),
		scrollContainerSelector: options.scrollContainerSelector,
	});

	onCleanup(() => {
		const timer = refreshTimer();
		if (timer) {
			clearTimeout(timer);
		}
	});

	const handleSearch = () => {
		setOffset(0);
		setScrollY(0);
		scrollToPosition(options.scrollContainerSelector, 0);
	};

	const [loadMoreRef, setLoadMoreRef] = createSignal<
		HTMLDivElement | undefined
	>(undefined);

	createEffect(() => {
		const el = loadMoreRef();
		if (!el) {
			return;
		}
		const hasNextPage = searchResultQuery.hasNextPage;
		const isFetching = searchResultQuery.isFetching;

		if (!hasNextPage || isFetching) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					searchResultQuery.fetchNextPage();
				}
			},
			{ threshold: 0.5, rootMargin: "2400px" },
		);
		observer.observe(el);
		onCleanup(() => observer.disconnect());
	});

	return {
		searchResultQuery,
		searchResults,
		hasData: () => searchResultData() !== undefined,
		totalCount: () => searchResultData()?.pages[0]?.total,
		contentState,
		filterStates: {
			tags: () => arrayState(tags),
			sources: () => arrayState(sources),
			projects: () => arrayState(allProjects),
			ips: () => arrayState(allIps),
			characters: () => arrayState(allCharacters),
			authors: () => arrayState(allAuthors),
		},
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
		retryFilters,
		refreshSearchResults,
		loadMoreRef,
		setLoadMoreRef,
		conditionKey,
	};
}
