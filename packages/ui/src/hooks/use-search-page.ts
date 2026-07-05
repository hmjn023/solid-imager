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
import type { QueryClient } from "@tanstack/solid-query";
import {
	createInfiniteQuery,
	createQuery,
	keepPreviousData,
} from "@tanstack/solid-query";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
import { searchQueryKeys } from "../query-options";
import { type QueryUiState, toQueryUiState } from "../query-state";

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
	// biome-ignore lint/suspicious/noExplicitAny: library type mismatch between oRPC and solid-query
	tags: () => any;
	// biome-ignore lint/suspicious/noExplicitAny: library type mismatch between oRPC and solid-query
	sources: () => any;
	// biome-ignore lint/suspicious/noExplicitAny: library type mismatch between oRPC and solid-query
	projects: () => any;
	// biome-ignore lint/suspicious/noExplicitAny: library type mismatch between oRPC and solid-query
	ips: () => any;
	// biome-ignore lint/suspicious/noExplicitAny: library type mismatch between oRPC and solid-query
	characters: () => any;
	// biome-ignore lint/suspicious/noExplicitAny: library type mismatch between oRPC and solid-query
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
	mode?: () => "simple" | "pro" | "vector";
	similarityAnchorMediaId?: () => string | null;
	similarityTopK?: () => number;
	gcTime?: number;
	refreshDebounceMs?: number;
}

export interface UseSearchPageResult {
	searchResultQuery: ReturnType<
		typeof createInfiniteQuery<MediaSearchResponse>
	>;
	searchResults: () => MediaSearchResponse["media"];
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
		mode = () => "simple",
		similarityAnchorMediaId = () => null,
		similarityTopK = () => 50,
		gcTime = DEFAULT_GC_TIME,
		refreshDebounceMs = DEFAULT_REFRESH_DEBOUNCE_MS,
	} = options;

	const tags = createQuery<TagResponse[]>(() => queries.tags());
	const sources = createQuery<SafeMediaSource[]>(() => queries.sources());
	const allProjects = createQuery<Project[]>(() => queries.projects());
	const allIps = createQuery<Ip[]>(() => queries.ips());
	const allCharacters = createQuery<Character[]>(() => queries.characters());
	const allAuthors = createQuery<Author[]>(() => queries.authors());

	const conditionKey = createMemo(() =>
		JSON.stringify(getSearchCondition() ?? null),
	);

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
			queryKey: searchQueryKeys.results({
				mode: mode(),
				sourceId: source,
				conditionKey: conditionKey(),
				sort: sortBy(),
				order: sortOrder(),
				limit: limit(),
				similarityAnchorMediaId: similarityAnchorMediaId(),
				similarityTopK: similarityTopK(),
			}),
			queryFn: async ({ pageParam, signal }) => {
				if (mode() === "vector") {
					const anchorMediaId = similarityAnchorMediaId();
					if (!(anchorMediaId && options.searchSimilar)) {
						return { media: [], total: 0 };
					}
					return await options.searchSimilar(
						{
							anchorMediaId,
							mediaSourceId: source,
							topK: similarityTopK(),
						},
						signal,
					);
				}
				return await searchMedia(
					source,
					{
						...params,
						offset: pageParam as number,
					},
					signal,
				);
			},
			initialPageParam: 0,
			getNextPageParam: (lastPage, allPages) => {
				if (mode() === "vector") return;
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
	const contentState = () =>
		toQueryUiState(
			{
				data: searchResultQuery.data ? searchResults() : undefined,
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
			void queryClient.invalidateQueries({ queryKey: searchQueryKeys.all() });
			setRefreshTimer(null);
			return;
		}
		setRefreshTimer(
			setTimeout(() => {
				void queryClient.invalidateQueries({ queryKey: searchQueryKeys.all() });
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
			{ threshold: 0.5, rootMargin: "1000px" },
		);
		observer.observe(el);
		onCleanup(() => observer.disconnect());
	});

	return {
		searchResultQuery,
		searchResults,
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
		refreshSearchResults,
		loadMoreRef,
		setLoadMoreRef,
		conditionKey,
	};
}
