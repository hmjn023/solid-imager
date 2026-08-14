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
	enableVirtualization?: boolean;
	scrollContainerSelector?: string;
}

export interface UseSearchPageResult {
	searchResultQuery: ReturnType<
		typeof createInfiniteQuery<MediaSearchResponse>
	>;
	searchResults: () => MediaSearchResponse["media"];
	hasData: () => boolean;
	totalCount: () => number | undefined;
	fetchNextPage: () => Promise<unknown>;
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
		enableVirtualization = false,
	} = options;
	const queryClient = useQueryClient();
	const tagsQueryKey = queries.tags().queryKey;
	const sourcesQueryKey = queries.sources().queryKey;
	const projectsQueryKey = queries.projects().queryKey;
	const ipsQueryKey = queries.ips().queryKey;
	const charactersQueryKey = queries.characters().queryKey;
	const authorsQueryKey = queries.authors().queryKey;

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
	const [tagsData, setTagsData] = createSignal<TagResponse[] | undefined>();
	const [sourcesData, setSourcesData] = createSignal<
		SafeMediaSource[] | undefined
	>();
	const [projectsData, setProjectsData] = createSignal<Project[] | undefined>();
	const [ipsData, setIpsData] = createSignal<Ip[] | undefined>();
	const [charactersData, setCharactersData] = createSignal<
		Character[] | undefined
	>();
	const [authorsData, setAuthorsData] = createSignal<Author[] | undefined>();

	createEffect(() => {
		tags.dataUpdatedAt;
		setTagsData(queryClient.getQueryData<TagResponse[]>(tagsQueryKey));
	});
	createEffect(() => {
		sources.dataUpdatedAt;
		setSourcesData(
			queryClient.getQueryData<SafeMediaSource[]>(sourcesQueryKey),
		);
	});
	createEffect(() => {
		allProjects.dataUpdatedAt;
		setProjectsData(queryClient.getQueryData<Project[]>(projectsQueryKey));
	});
	createEffect(() => {
		allIps.dataUpdatedAt;
		setIpsData(queryClient.getQueryData<Ip[]>(ipsQueryKey));
	});
	createEffect(() => {
		allCharacters.dataUpdatedAt;
		setCharactersData(
			queryClient.getQueryData<Character[]>(charactersQueryKey),
		);
	});
	createEffect(() => {
		allAuthors.dataUpdatedAt;
		setAuthorsData(queryClient.getQueryData<Author[]>(authorsQueryKey));
	});

	const conditionKey = createMemo(() =>
		JSON.stringify(getSearchCondition() ?? null),
	);

	const searchResultQueryOptions = createMemo(() => {
		return buildSearchResultsQueryOptions({
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
		});
	});
	const searchResultQuery = createInfiniteQuery(searchResultQueryOptions);
	const fetchNextPage = () =>
		isSearchStateRestored()
			? searchResultQuery.fetchNextPage()
			: Promise.resolve();
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
	const arrayState = <T>(
		query: {
			data: T[] | undefined;
			error: unknown;
			status: "pending" | "error" | "success";
			fetchStatus: "idle" | "fetching" | "paused";
		},
		data: () => T[] | undefined,
	) =>
		toQueryUiState(
			{
				data: data(),
				error: query.error,
				status: query.status,
				fetchStatus: query.fetchStatus,
			},
			{ isEmpty: (items) => items.length === 0 },
		);
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
		const source = sourcesData()?.find((item) => item.id === mediaSourceId);
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
		isReady: () =>
			isSearchStateRestored() &&
			Boolean(searchResultData()) &&
			!searchResultQuery.isLoading,
		hasNextPage: () => searchResultQuery.hasNextPage,
		isFetchingNextPage: () => searchResultQuery.isFetchingNextPage,
		fetchNextPage,
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
		if (enableVirtualization) {
			return;
		}
		const el = loadMoreRef();
		if (!el) {
			return;
		}
		const hasNextPage = searchResultQuery.hasNextPage;
		const isFetching = searchResultQuery.isFetching;

		if (!isSearchStateRestored() || !hasNextPage || isFetching) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && isSearchStateRestored()) {
					fetchNextPage();
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
		fetchNextPage,
		contentState,
		filterStates: {
			tags: () => arrayState(tags, tagsData),
			sources: () => arrayState(sources, sourcesData),
			projects: () => arrayState(allProjects, projectsData),
			ips: () => arrayState(allIps, ipsData),
			characters: () => arrayState(allCharacters, charactersData),
			authors: () => arrayState(allAuthors, authorsData),
		},
		filterData: {
			get tags() {
				return tagsData();
			},
			get projects() {
				return projectsData();
			},
			get ips() {
				return ipsData();
			},
			get characters() {
				return charactersData();
			},
			get authors() {
				return authorsData();
			},
		},
		sources: sourcesData,
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
