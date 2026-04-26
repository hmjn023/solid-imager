import type {
	MediaSearchRequest,
	MediaSearchResponse,
} from "@solid-imager/core/domain/media/schemas";
import type { QueryClient } from "@tanstack/solid-query";
import { createInfiniteQuery, keepPreviousData } from "@tanstack/solid-query";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";

const DEFAULT_GC_TIME = 1000 * 60 * 5;

export interface UseSearchPageOptions {
	searchMedia: (
		sourceId: string | undefined,
		params: MediaSearchRequest,
	) => Promise<MediaSearchResponse>;
	queryClient: QueryClient;
	selectedSource: () => string | null | undefined;
	getSearchCondition: () => MediaSearchRequest["condition"];
	sortBy: () => MediaSearchRequest["sort"];
	sortOrder: () => "asc" | "desc";
	limit: () => number;
	scrollY: () => number;
	setScrollY: (y: number) => void;
	setOffset: (o: number) => void;
	gcTime?: number;
}

export interface UseSearchPageResult {
	searchResultQuery: ReturnType<
		typeof createInfiniteQuery<MediaSearchResponse>
	>;
	searchResults: () => MediaSearchResponse["media"];
	isRestored: () => boolean;
	handleSearch: () => void;
	loadMoreRef: () => HTMLDivElement | undefined;
	setLoadMoreRef: (el: HTMLDivElement | undefined) => void;
	conditionKey: () => string;
}

export function useSearchPage(
	options: UseSearchPageOptions,
): UseSearchPageResult {
	const {
		searchMedia,
		selectedSource,
		getSearchCondition,
		sortBy,
		sortOrder,
		limit,
		scrollY,
		setScrollY,
		setOffset,
		gcTime = DEFAULT_GC_TIME,
	} = options;

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

	const [isRestored, setIsRestored] = createSignal(false);

	createEffect(() => {
		if (
			!(searchResultQuery.isLoading || isRestored()) &&
			searchResultQuery.data &&
			searchResultQuery.data.pages.length > 0 &&
			scrollY() > 0
		) {
			requestAnimationFrame(() => {
				window.scrollTo(0, scrollY());
			});
			setIsRestored(true);
		}
	});

	onCleanup(() => {
		if (!isServer) {
			setScrollY(window.scrollY);
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
		isRestored,
		handleSearch,
		loadMoreRef,
		setLoadMoreRef,
		conditionKey,
	};
}
