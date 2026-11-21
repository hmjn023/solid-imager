import type {
	PixivBookmarkFilter,
	PixivFeed,
	ViewerProvider,
} from "@solid-imager/core/external-viewer";
import { infiniteQueryOptions } from "@tanstack/solid-query";

export type PixivCollection = PixivFeed | "bookmarks";
type ViewerPage = { posts: { id: number }[]; hasNextPage: boolean };

export function pixivQueryScope(base: string, userId = "guest", expiresAt = 0) {
	return [base, userId, expiresAt];
}

export function viewerSearchKey(
	provider: ViewerProvider,
	scope: string,
	page: number,
	tags = "",
	choices: Record<string, string> = {},
	literal = false,
	userId: string | null = null,
	feed: PixivCollection = "daily",
	bookmark?: PixivBookmarkFilter,
) {
	return [
		"external-viewer",
		provider,
		tags,
		choices,
		literal,
		userId,
		feed,
		feed === "bookmarks" && !tags && userId === null ? bookmark : null,
		scope,
		page,
	] as const;
}

export function viewerPagination(page: number) {
	return {
		initialPageParam: page,
		getNextPageParam: (
			result: ViewerPage,
			_pages: ViewerPage[],
			current: number,
		) => (result.hasNextPage && current < 1000 ? current + 1 : undefined),
		getPreviousPageParam: (
			_result: ViewerPage,
			_pages: ViewerPage[],
			current: number,
		) => (current > 1 ? current - 1 : undefined),
	};
}

export function initialViewerSearchOptions<T extends ViewerPage>(
	provider: ViewerProvider,
	scope: string,
	run: () => Promise<T>,
) {
	return infiniteQueryOptions({
		...viewerPagination(1),
		queryKey: viewerSearchKey(provider, scope, 1),
		queryFn: run,
	});
}

export function viewerPostQueryOptions<T>(
	provider: ViewerProvider,
	id: number | undefined,
	load: (id: number) => Promise<T>,
	scope: (string | number)[] = [],
) {
	return {
		queryKey: [
			provider,
			provider === "pixiv" ? "artwork" : "post",
			id,
			...scope,
		],
		queryFn: () => load(id ?? 0),
		staleTime: 30_000,
		retry: false,
	};
}
