import { t } from "@solid-imager/i18n";
import type { ViewerTag } from "@solid-imager/core/external-viewer";
import {
	createEffect,
	createMemo,
	createSignal,
	Match,
	on,
	onCleanup,
	Show,
	Switch,
	type JSX,
} from "solid-js";
import {
	EmptyState,
	ErrorState,
	OfflineState,
	QueryStatus,
} from "../async-state";
import { DanbooruSearchComposer } from "../danbooru/search-composer";
import { ViewerLoadBoundary } from "./load-boundary";
import { LoadingRegion, MediaGridSkeleton } from "../skeleton";
import type { ViewerDetailNavigation } from "./detail";
import {
	ViewerResultsGrid,
	type ViewerGridItemDescription,
} from "./results-grid";
import type { createViewerSearch } from "./use-viewer-search";

export type ViewerNavigation = {
	selectedPostId?: number;
	postHref: (id: number) => string;
	onOpenPost: (id: number, replace?: boolean) => void;
	onClosePost: () => void;
};

type ViewerResults = { posts: { id: number }[]; hasNextPage: boolean };

export function ViewerWorkspace<T extends ViewerResults>(
	props: ViewerNavigation & {
		providerName: "Danbooru" | "pixiv";
		siteUrl: string;
		browse: ReturnType<typeof createViewerSearch<T>>;
		suggestTags: (query: string) => Promise<ViewerTag[]>;
		describePost: (post: T["posts"][number]) => ViewerGridItemDescription;
		errorTitle: string;
		emptyTitle: string;
		actions?: JSX.Element;
		renderSearchInfo?: (result: T) => JSX.Element;
		renderDetail: (navigation: ViewerDetailNavigation) => JSX.Element;
	},
) {
	const browse = props.browse;
	const results = browse.results;
	const state = browse.state;
	const selectedIndex = createMemo(
		() =>
			state().data?.posts.findIndex(
				(post) => post.id === props.selectedPostId,
			) ?? -1,
	);
	const neighbor = (direction: number) =>
		selectedIndex() < 0
			? undefined
			: state().data?.posts[selectedIndex() + direction]?.id;
	const retry = async () => {
		await results.refetch();
	};
	let collectionTitle: HTMLHeadingElement | undefined;
	const [returnFocusId, setReturnFocusId] = createSignal<number>();
	createEffect(
		on(
			() => props.selectedPostId,
			(id, previous) => {
				if (id && !previous) setReturnFocusId(id);
				browse.rememberDetail(id);
			},
		),
	);
	createEffect(() => {
		const id = returnFocusId();
		if (
			!id ||
			props.selectedPostId ||
			state().phase === "pending" ||
			browse.restoring()
		)
			return;
		const grid = browse.gridHandle();
		let cancelled = false;
		const frame = requestAnimationFrame(async () => {
			const focused = await grid?.focusPost(id);
			if (cancelled) return;
			if (!focused) collectionTitle?.focus({ preventScroll: true });
			setReturnFocusId(undefined);
		});
		onCleanup(() => {
			cancelled = true;
			cancelAnimationFrame(frame);
		});
	});
	// Keep the next/previous action working when browsing across a loaded page boundary.
	createEffect(() => {
		const index = selectedIndex();
		if (index < 0 || browse.restoring() || results.isFetching) return;
		if (
			index === (state().data?.posts.length ?? 0) - 1 &&
			browse.canAutoLoadNext() &&
			!results.isFetchNextPageError
		) {
			void browse.loadMore();
		} else if (
			index === 0 &&
			browse.canAutoLoadPrevious() &&
			!results.isFetchPreviousPageError
		) {
			void browse.loadPrevious();
		}
	});
	return (
		<div class="workspace-theme flex h-full min-h-0 min-w-0 flex-col bg-background text-foreground">
			<Show
				when={props.selectedPostId}
				fallback={
					<>
						<header class="shrink-0 border-b border-border px-3 py-3 sm:px-4">
							<div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
								<h1
									ref={collectionTitle}
									tabindex="-1"
									class="mr-auto font-semibold text-xl"
								>
									{props.providerName}
								</h1>
								{props.actions}
								<a
									class="text-primary text-sm underline-offset-4 hover:underline"
									href={props.siteUrl}
									target="_blank"
									rel="noopener noreferrer"
								>
									{t("workspace.openSite")}
								</a>
							</div>
							<DanbooruSearchComposer
								provider={props.providerName}
								draft={browse.draft()}
								onDraftChange={browse.setDraft}
								onSubmit={() => browse.submit()}
								suggestTags={props.suggestTags}
							/>
						</header>
						<div
							class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 scrollbar-stable sm:px-4"
							data-media-scroll={props.providerName}
							ref={(area) => {
								browse.setScrollArea(area);
								onCleanup(() => browse.setScrollArea(undefined));
							}}
							onScroll={browse.rememberScroll}
						>
							<QueryStatus
								hideWhenIdle
								fetchState={
									results.isFetchingNextPage || results.isFetchingPreviousPage
										? "idle"
										: state().fetchState
								}
								hasData={!!state().data}
								hasError={results.isRefetchError}
								offlineLabel={t(
									"searchScreen.offlineShowingSavedSearchResults",
								)}
								updatingLabel={t("searchScreen.updatingSearchResults")}
							/>
							<Switch>
								<Match when={state().phase === "pending"}>
									<LoadingRegion label={t("workspace.loadingPosts")}>
										<MediaGridSkeleton aspectRatio="4/3" />
									</LoadingRegion>
								</Match>
								<Match when={state().phase === "offline"}>
									<OfflineState onRetry={retry} />
								</Match>
								<Match when={state().phase === "error"}>
									<ErrorState
										title={props.errorTitle}
										description={results.error?.message}
										onRetry={retry}
									/>
								</Match>
								<Match when={state().data}>
									{(data) => (
										<>
											<p
												class="mb-2 text-muted-foreground text-sm"
												aria-live="polite"
											>
												{t("workspace.showingValueResults", {
													value0: String(data().posts.length.toLocaleString()),
												})}
											</p>
											{props.renderSearchInfo?.(data())}
											<Show when={browse.hasPreviousPage()}>
												<ViewerLoadBoundary
													direction="previous"
													root={browse.scrollArea}
													autoLoad={
														!browse.restoring() &&
														!results.isFetching &&
														browse.canAutoLoadPrevious() &&
														!!browse.gridHandle()
													}
													loading={results.isFetchingPreviousPage}
													failed={results.isFetchPreviousPageError}
													onLoad={browse.loadPrevious}
												/>
											</Show>
											<Show
												when={data().posts.length}
												fallback={
													<Show
														when={
															!browse.hasNextPage() && !browse.hasPreviousPage()
														}
													>
														<EmptyState
															title={props.emptyTitle}
															description={t(
																"workspace.changeTheTagsAndSearchAgain",
															)}
														/>
													</Show>
												}
											>
												<ViewerResultsGrid<T["posts"][number]>
													posts={data().posts}
													describe={props.describePost}
													onGridReady={browse.setGridHandle}
													postHref={props.postHref}
													onOpenPost={(id) => {
														browse.rememberScroll();
														props.onOpenPost(id);
													}}
												/>
											</Show>
											<Show
												when={browse.hasNextPage()}
												fallback={
													<Show when={data().posts.length}>
														<p class="py-3 text-center text-sm text-muted-foreground">
															{t("workspace.allPostsDisplayed")}
														</p>
													</Show>
												}
											>
												<ViewerLoadBoundary
													direction="next"
													root={browse.scrollArea}
													autoLoad={
														!browse.restoring() &&
														!results.isFetching &&
														browse.canAutoLoadNext() &&
														!!browse.gridHandle()
													}
													loading={results.isFetchingNextPage}
													failed={results.isFetchNextPageError}
													onLoad={browse.loadMore}
												/>
											</Show>
										</>
									)}
								</Match>
							</Switch>
						</div>
					</>
				}
			>
				{(id) =>
					props.renderDetail({
						get postId() {
							return id();
						},
						get previousId() {
							return neighbor(-1);
						},
						get nextId() {
							return neighbor(1);
						},
						onNavigate: (postId) => props.onOpenPost(postId, true),
						onBack: props.onClosePost,
					})
				}
			</Show>
		</div>
	);
}
