import type { PixivRelatedPage } from "@solid-imager/core/external-viewer";
import { t } from "@solid-imager/i18n";
import {
	createInfiniteQuery,
	useQueryClient,
	type InfiniteData,
} from "@tanstack/solid-query";
import { createEffect, createMemo, onCleanup, onMount, Show } from "solid-js";
import { Button } from "../button";
import { ErrorState } from "../async-state";
import { LoadingRegion, MediaGridSkeleton } from "../skeleton";
import { ViewerResultsGrid } from "./results-grid";
import {
	readPixivRelatedSnapshot,
	writePixivRelatedSnapshot,
	type PixivRelatedSnapshot,
} from "./pixiv-related-history";
import { pixivImageHref } from "./post-media";

export function PixivRelatedWorks(props: {
	history: Map<string, PixivRelatedSnapshot>;
	postId: number;
	scope: (string | number)[];
	enabled: boolean;
	apiBase: string;
	load: (id: number, ids?: number[]) => Promise<PixivRelatedPage>;
	postHref: (id: number) => string;
	onOpenPost: (id: number) => void;
}) {
	const key = () => JSON.stringify([props.postId, ...props.scope]);
	const initialKey = key();
	const saved =
		props.history.get(initialKey) ?? readPixivRelatedSnapshot(initialKey);
	let restoring = !!saved;
	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	const queryKey = () => [
		"pixiv",
		"related-pages",
		props.postId,
		...props.scope,
	];
	const client = useQueryClient();
	if (saved) client.setQueryData(queryKey(), saved.data);
	let restored = false;
	let disposed = false;
	let section!: HTMLElement;
	let frame: number | undefined;
	onCleanup(() => {
		disposed = true;
		if (frame !== undefined) cancelAnimationFrame(frame);
		if (saveTimer !== undefined) clearTimeout(saveTimer);
	});
	function scroller() {
		let element = section.parentElement;
		while (element) {
			if (/(auto|scroll)/.test(getComputedStyle(element).overflowY))
				return element;
			element = element.parentElement;
		}
	}
	function remember(focusId?: number) {
		if (restoring || disposed || !query.data || !section) return;
		const snapshot = {
			data: query.data,
			scrollTop: scroller()?.scrollTop ?? 0,
			focusId,
		};
		props.history.set(key(), snapshot);
		writePixivRelatedSnapshot(key(), snapshot);
	}
	function open(id: number) {
		remember(id);
		props.onOpenPost(id);
	}
	onMount(() => {
		const area = scroller();
		const save = () => {
			if (saveTimer !== undefined) clearTimeout(saveTimer);
			saveTimer = setTimeout(() => {
				saveTimer = undefined;
				remember();
			}, 200);
		};
		area?.addEventListener("scroll", save, { passive: true });
		window.addEventListener("pagehide", rememberPage);
		function rememberPage() {
			remember();
		}
		onCleanup(() => {
			area?.removeEventListener("scroll", save);
			window.removeEventListener("pagehide", rememberPage);
		});
	});
	const query = createInfiniteQuery<
		PixivRelatedPage,
		Error,
		InfiniteData<PixivRelatedPage, number[] | undefined>,
		(string | number)[],
		number[] | undefined
	>(() => ({
		queryKey: queryKey(),

		refetchOnMount: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		initialPageParam: undefined as number[] | undefined,
		queryFn: ({ pageParam }) =>
			props.load(props.postId, pageParam?.slice(0, 18)),
		getNextPageParam: (last, pages, param) => {
			const seen = new Set([
				props.postId,
				...pages.flatMap((page) => page.posts.map((post) => post.id)),
			]);
			const remaining = [
				...new Set(param ? param.slice(18) : last.nextIds),
			].filter((id) => !seen.has(id));
			return remaining.length ? remaining : undefined;
		},
		enabled: props.enabled,
		gcTime: 0,
		staleTime: 30_000,
		retry: false,
	}));
	createEffect(() => {
		if (query.data) remember();
	});
	const posts = createMemo(() => {
		if (query.isPending || !query.data) return;
		return [
			...new Map(
				query.data.pages
					.flatMap((page) => page.posts)
					.map((post) => [post.id, post]),
			).values(),
		];
	});
	return (
		<section
			ref={(element) => {
				section = element;
			}}
			aria-label={t("pixivArtworkDetail.relatedWorks")}
			class="min-w-0 space-y-3 p-3 sm:p-4"
		>
			<h2 class="text-sm font-semibold">
				{t("pixivArtworkDetail.relatedWorks")}
			</h2>
			<Show when={query.isPending}>
				<LoadingRegion label={t("pixivArtworkDetail.loadingRelated")}>
					<MediaGridSkeleton aspectRatio="4/3" count={18} />
				</LoadingRegion>
			</Show>
			<Show when={query.isError && !posts()}>
				<ErrorState
					title={t("pixivArtworkDetail.relatedError")}
					onRetry={async () => {
						await query.refetch();
					}}
				/>
			</Show>
			<Show when={posts()}>
				{(items) => (
					<Show
						when={items().length}
						fallback={
							<p class="text-sm text-muted-foreground">
								{t("pixivArtworkDetail.noRelated")}
							</p>
						}
					>
						<ViewerResultsGrid
							posts={items()}
							postHref={props.postHref}
							onOpenPost={open}
							onGridReady={(grid) => {
								if (!grid || !saved || restored || key() !== initialKey) return;
								restored = true;
								frame = requestAnimationFrame(() => {
									void (
										saved.focusId
											? grid.focusPost(saved.focusId)
											: Promise.resolve(false)
									).then(() => {
										if (disposed) return;
										frame = requestAnimationFrame(() => {
											const area = scroller();
											if (area) area.scrollTop = saved.scrollTop;
											restoring = false;
										});
									});
								});
							}}
							describe={(post) => ({
								title:
									post.title ||
									t("pixivScreen.pixivValue", { value0: String(post.id) }),
								info: post.author,
								thumbnail:
									post.thumbnail &&
									pixivImageHref(props.apiBase, post.thumbnail),
							})}
						/>
					</Show>
				)}
			</Show>
			<Show when={query.isFetchNextPageError}>
				<p role="alert" class="text-sm text-destructive">
					{t("pixivArtworkDetail.relatedError")}
				</p>
			</Show>
			<Show when={query.hasNextPage}>
				<Button
					variant="outline"
					disabled={query.isFetching}
					aria-busy={query.isFetchingNextPage}
					onClick={() => {
						if (!query.isFetching)
							void query.fetchNextPage({ cancelRefetch: false });
					}}
				>
					{query.isFetchingNextPage
						? t("pixivArtworkDetail.loadingRelated")
						: query.isFetchNextPageError
							? t("actions.retry")
							: t("pixivArtworkDetail.moreRelated")}
				</Button>
			</Show>
			<p class="sr-only" aria-live="polite">
				{t("workspace.showingValueResults", {
					value0: String(posts()?.length ?? 0),
				})}
			</p>
		</section>
	);
}
