import type { ViewerTag } from "@solid-imager/core/external-viewer";
import {
	createEffect,
	createMemo,
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
import { PaginationControls } from "../pagination-controls";
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
	let returnFocusId: number | undefined;
	createEffect(
		on(
			() => props.selectedPostId,
			(id, previous) => {
				if (id && !previous) returnFocusId = id;
			},
		),
	);
	createEffect(() => {
		const area = browse.scrollArea();
		if (
			!area ||
			props.selectedPostId ||
			!returnFocusId ||
			state().phase === "pending"
		)
			return;
		const frame = requestAnimationFrame(() => {
			const tile = area.querySelector<HTMLElement>(
				`a[data-media-id="${returnFocusId}"]`,
			);
			(tile ?? collectionTitle)?.focus({ preventScroll: true });
			returnFocusId = undefined;
		});
		onCleanup(() => cancelAnimationFrame(frame));
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
									サイトを開く ↗
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
								fetchState={state().fetchState}
								hasData={!!state().data}
								hasError={results.isError}
								offlineLabel="オフラインのため保存済みの検索結果を表示しています"
								updatingLabel="検索結果を更新中..."
							/>
							<Switch>
								<Match when={state().phase === "pending"}>
									<LoadingRegion label="投稿を読み込み中">
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
												{browse.params().page} ページ · {data().posts.length} 件
											</p>
											{props.renderSearchInfo?.(data())}
											<Show
												when={data().posts.length}
												fallback={
													<EmptyState
														title={props.emptyTitle}
														description="タグを変更して検索してください。"
													/>
												}
											>
												<ViewerResultsGrid<T["posts"][number]>
													posts={data().posts}
													describe={props.describePost}
													postHref={props.postHref}
													onOpenPost={(id) => {
														browse.rememberScroll();
														props.onOpenPost(id);
													}}
												/>
											</Show>
										</>
									)}
								</Match>
							</Switch>
						</div>
						<PaginationControls
							label={props.providerName + " のページ"}
							class="shrink-0 justify-center border-t border-border p-2"
							currentPage={browse.params().page}
							hasNextPage={
								state().data?.hasNextPage === true &&
								browse.params().page < 1000
							}
							disabled={results.isFetching}
							onPageChange={browse.changePage}
						/>
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
