import type { PixivRelatedPage } from "@solid-imager/core/external-viewer";
import { t } from "@solid-imager/i18n";
import {
	createInfiniteQuery,
	onlineManager,
	useQueryClient,
	type InfiniteData,
} from "@tanstack/solid-query";
import {
	createEffect,
	createMemo,
	createSignal,
	Match,
	onCleanup,
	onMount,
	Show,
	Switch,
} from "solid-js";
import {
	ErrorState,
	OfflineState,
	QueryStatus,
	RetryButton,
} from "../async-state";
import { Button } from "../button";
import { toQueryUiState } from "../query-state";
import { LoadingRegion, MediaGridSkeleton } from "../skeleton";
import { ViewerResultsGrid } from "./results-grid";
import {
	readPixivRelatedSnapshot,
	writePixivRelatedSnapshot,
	type PixivRelatedSnapshot,
} from "./pixiv-related-history";
import { pixivThumbnailSource } from "./post-media";

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
	const [isOnline, setOnline] = createSignal(true);
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
	let restoreObserver: ResizeObserver | undefined;
	onCleanup(() => {
		disposed = true;
		if (frame !== undefined) cancelAnimationFrame(frame);
		if (saveTimer !== undefined) clearTimeout(saveTimer);
		restoreObserver?.disconnect();
	});
	function scroller() {
		let element = section.parentElement;
		while (element) {
			if (/(auto|scroll)/.test(getComputedStyle(element).overflowY))
				return element;
			element = element.parentElement;
		}
	}
	function restoreScroll(top: number) {
		const restore = () => {
			if (!disposed && key() === initialKey) {
				const area = scroller();
				if (!area) return false;
				area.scrollTop = top;
			}
			restoring = false;
			restoreObserver?.disconnect();
			return true;
		};
		if (restore()) return;
		// The grid can mount before the stylesheet establishes its scroll area.
		restoreObserver = new ResizeObserver(restore);
		restoreObserver.observe(section);
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
		setOnline(onlineManager.isOnline());
		onCleanup(onlineManager.subscribe(setOnline));
		const save = (event: Event) => {
			if (event.target !== scroller()) return;
			if (saveTimer !== undefined) clearTimeout(saveTimer);
			saveTimer = setTimeout(() => {
				saveTimer = undefined;
				remember();
			}, 200);
		};
		document.addEventListener("scroll", save, { capture: true, passive: true });
		window.addEventListener("pagehide", rememberPage);
		function rememberPage() {
			remember();
		}
		onCleanup(() => {
			document.removeEventListener("scroll", save, true);
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
	const state = () =>
		toQueryUiState({
			data: query.data,
			error: query.error,
			status: query.status,
			fetchStatus: isOnline() ? query.fetchStatus : "paused",
		});
	const retry = async () => {
		await query.refetch();
	};
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
			<QueryStatus
				fetchState={state().fetchState}
				hasData={state().data !== undefined}
				hasError={query.isRefetchError}
				hideWhenIdle
				offlineLabel={t("sourceMediaScreen.offlineShowingSavedData")}
				updatingLabel={t("pixivArtworkDetail.updatingRelated")}
			/>
			<Show when={query.isRefetchError && state().fetchState === "idle"}>
				<RetryButton onRetry={retry} />
			</Show>
			<Switch>
				<Match when={state().phase === "offline"}>
					<OfflineState onRetry={retry} />
				</Match>
				<Match when={state().phase === "error"}>
					<ErrorState
						title={t("pixivArtworkDetail.relatedError")}
						onRetry={retry}
					/>
				</Match>
				<Match when={state().phase === "pending"}>
					<LoadingRegion label={t("pixivArtworkDetail.loadingRelated")}>
						<MediaGridSkeleton aspectRatio="4/3" count={18} />
					</LoadingRegion>
				</Match>
			</Switch>
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
										frame = requestAnimationFrame(() =>
											restoreScroll(saved.scrollTop),
										);
									});
								});
							}}
							describe={(post) => ({
								title:
									post.title ||
									t("pixivScreen.pixivValue", { value0: String(post.id) }),
								info: post.author,
								thumbnail: pixivThumbnailSource(props.apiBase, post.thumbnail),
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
					disabled={state().fetchState !== "idle"}
					aria-busy={query.isFetchingNextPage}
					onClick={() => {
						if (state().fetchState === "idle")
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
