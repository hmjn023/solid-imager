import type { Media } from "@solid-imager/core/domain/media/schemas";
import {
	createVirtualizer,
	createWindowVirtualizer,
	type Range,
	type Virtualizer,
} from "@tanstack/solid-virtual";
import type { Accessor, JSX, Setter } from "solid-js";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	Match,
	onCleanup,
	onMount,
	Show,
	Switch,
} from "solid-js";
import { EmptyState, ErrorState, OfflineState } from "./async-state";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "./context-menu";
import type { MediaGridImageLoadPolicy } from "./media-grid-item";
import { createMediaPreviewSelectHandler } from "./media-preview-selection";
import type { QueryUiState } from "./query-state";
import {
	getMediaGridColumnCount,
	LoadingRegion,
	MediaGridSkeleton,
	mediaGridClassName,
} from "./skeleton";

const VIRTUALIZATION_THRESHOLD = 100;
const GRID_GAP_PX = 12;
const WINDOW_VIRTUAL_ROWS_OVERSCAN = 4;
const ELEMENT_PREFETCH_ROWS = 3;
const ELEMENT_RETAIN_ROWS = 4;
// Start the next page before the user reaches the last prefetched rows. The
// request itself is independent of image loading, so this does not increase
// the number of mounted grid items.
const LOAD_MORE_ROWS_AHEAD = 12;
const INITIAL_PRIORITY_ROWS = 2;
const INITIAL_HIGH_PRIORITY_MEDIA = 2;
const INITIAL_SKELETON_ROWS = 3;

type ScrollDirection = "backward" | "forward" | null;

function extractDirectionalRows(
	range: Range,
	direction: ScrollDirection,
): number[] {
	const rowsBefore =
		direction === "backward" ? ELEMENT_PREFETCH_ROWS : ELEMENT_RETAIN_ROWS;
	const rowsAfter =
		direction === "backward" ? ELEMENT_RETAIN_ROWS : ELEMENT_PREFETCH_ROWS;
	const start = Math.max(range.startIndex - rowsBefore, 0);
	const end = Math.min(range.endIndex + rowsAfter, range.count - 1);

	return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

type SourceMediaGridProps = {
	detailBasePath?: string;
	itemAspectRatio?: number;
	scrollMode?: "element" | "window";
	mediaResults: Accessor<Media[]>;
	mediaSourceId: Accessor<string | undefined>;
	state: Accessor<QueryUiState<Media[]>>;
	isFetchingNextPage: boolean;
	onRetry?: () => void | Promise<void>;
	contextMenuMediaId?: Accessor<string | null>;
	setContextMenuMediaId?: Setter<string | null>;
	onDelete?: (mediaId: string) => void;
	onCopyMove?: (mediaId: string, mode: "copy" | "move") => void;
	onSyncSingleMedia?: (mediaId: string) => void;
	onToggleSelect?: (mediaId: string) => void;
	isBulkSelectMode?: () => boolean;
	isSelected?: (mediaId: string) => boolean;
	onBulkAction?: () => void;
	onClearSelection?: () => void;
	selectedCount?: () => number;
	setLoadMoreRef: (el: HTMLDivElement) => void;
	/** Whether there are more pages to load. */
	hasNextPage?: boolean;
	/** Called when virtual scroll reaches near the end. */
	onLoadMore?: () => void;
	/** Select a media item for the wide collection inspector. */
	onPreviewSelect?: (media: Media) => void;
	previewSelectedMediaId?: Accessor<string | null>;
	/** Render a single media grid item. */
	renderItem: (
		media: Media,
		options: {
			imageLoadPolicy?: MediaGridImageLoadPolicy;
			onContextMenu: () => void;
			priority?: boolean;
			isBulkSelectMode?: boolean;
			isSelected?: boolean;
			onPreviewSelect?: () => void;
			isPreviewSelected?: boolean;
		},
	) => JSX.Element;
	/** Enable virtualization for large lists. Default: false. */
	enableVirtualization?: boolean;
	/** Disable right-click context menu. Default: false. */
	disableContextMenu?: boolean;
	/** Show result count above grid. Default: true. */
	showResultCount?: boolean;
	/** Show empty state message. Default: true. */
	showEmptyState?: boolean;
	/** Show "Open in New Tab" context menu item. Default: true. */
	showOpenInNewTab?: boolean;
	/** Total result count. If omitted, uses mediaResults().length (may not reflect total). */
	totalCount?: number;
	/** Screen-specific copy for the initial error state. */
	errorTitle?: string;
};

export function SourceMediaGrid(props: SourceMediaGridProps) {
	const showResultCount = () => props.showResultCount ?? true;
	const showEmptyState = () => props.showEmptyState ?? true;
	const showOpenInNewTab = () => props.showOpenInNewTab ?? true;
	const enableVirtualization = () => props.enableVirtualization ?? false;
	const disableContextMenu = () => props.disableContextMenu ?? false;
	const totalCount = () => props.totalCount ?? props.mediaResults().length;
	const errorMessage = () => {
		const error = props.state().error;
		return error instanceof Error ? error.message : "API接続に失敗しました";
	};

	// --- Virtual grid setup ---
	const [windowWidth, setWindowWidth] = createSignal(0);
	const [mediaGridWidth, setMediaGridWidth] = createSignal(0);
	const [scrollElement, setScrollElement] = createSignal<HTMLElement | null>(
		null,
	);
	const [scrollMargin, setScrollMargin] = createSignal(0);
	const [elementLoadState, setElementLoadState] = createSignal<{
		direction: ScrollDirection;
		endIndex: number;
		startIndex: number;
	} | null>(null);
	let mediaGridRef: HTMLDivElement | undefined;
	let metricsFrameId: number | undefined;

	const columnCount = createMemo(() => {
		const width = mediaGridWidth() || windowWidth();
		return getMediaGridColumnCount(width);
	});

	const mediaItemWidth = createMemo(() => {
		const width = mediaGridWidth();
		const columns = columnCount();
		if (!(width > 0 && columns > 0)) return 0;
		return Math.max((width - GRID_GAP_PX * (columns - 1)) / columns, 0);
	});

	const mediaItemHeight = createMemo(() => {
		const width = mediaItemWidth();
		if (width <= 0) return 0;
		return width / (props.itemAspectRatio ?? 3 / 4);
	});

	const rowCount = createMemo(() => {
		const columns = columnCount();
		return columns > 0 ? Math.ceil(props.mediaResults().length / columns) : 0;
	});
	const getRowMedia = (rowIndex: number) => {
		const columns = columnCount();
		if (columns <= 0) return [];
		const results = props.mediaResults();
		return results.slice(rowIndex * columns, (rowIndex + 1) * columns);
	};

	const windowRowVirtualizer = createWindowVirtualizer<HTMLDivElement>({
		get count() {
			return rowCount();
		},
		estimateSize: () => mediaItemHeight() || 320,
		gap: GRID_GAP_PX,
		getItemKey: (index) => index,
		overscan: WINDOW_VIRTUAL_ROWS_OVERSCAN,
		get scrollMargin() {
			return scrollMargin();
		},
	});

	let elementRowVirtualizer:
		| Virtualizer<HTMLElement, HTMLDivElement>
		| undefined;
	elementRowVirtualizer = createVirtualizer<HTMLElement, HTMLDivElement>({
		get count() {
			return rowCount();
		},
		getScrollElement: () => scrollElement(),
		estimateSize: () => mediaItemHeight() || 320,
		gap: GRID_GAP_PX,
		getItemKey: (index) => index,
		overscan: 0,
		onChange: (instance) => {
			const range = instance.range;
			const nextState = range
				? {
						direction: instance.scrollDirection,
						endIndex: range.endIndex,
						startIndex: range.startIndex,
					}
				: null;
			setElementLoadState((previous) => {
				if (
					previous?.direction === nextState?.direction &&
					previous?.endIndex === nextState?.endIndex &&
					previous?.startIndex === nextState?.startIndex
				) {
					return previous;
				}
				return nextState;
			});
		},
		rangeExtractor: (range) =>
			extractDirectionalRows(
				range,
				elementRowVirtualizer?.scrollDirection ?? null,
			),
		get scrollMargin() {
			return scrollMargin();
		},
	});
	const mediaRowVirtualizer = () =>
		props.scrollMode === "element"
			? (elementRowVirtualizer ?? windowRowVirtualizer)
			: windowRowVirtualizer;

	const shouldVirtualize = createMemo(
		() =>
			enableVirtualization() &&
			props.mediaResults().length > VIRTUALIZATION_THRESHOLD &&
			mediaItemWidth() > 0,
	);
	const virtualizationPending = createMemo(
		() =>
			enableVirtualization() &&
			props.mediaResults().length > VIRTUALIZATION_THRESHOLD &&
			mediaGridWidth() <= 0,
	);
	const initialPriorityMediaCount = createMemo(() =>
		Math.max(columnCount() * INITIAL_PRIORITY_ROWS, 1),
	);
	const resolveElementImageLoadPolicy = (
		rowIndex: number,
		mediaIndex: number,
	): MediaGridImageLoadPolicy => {
		const state = elementLoadState();
		if (!state) {
			// A virtualizer can briefly have no measured range while its scroll
			// container is being restored. Keep mounted rows loadable so a
			// transient range reset does not blank the entire viewport.
			return {
				enabled: true,
				fetchpriority:
					mediaIndex < INITIAL_HIGH_PRIORITY_MEDIA ? "high" : undefined,
				loading: "eager",
			};
		}

		const isVisible =
			rowIndex >= state.startIndex && rowIndex <= state.endIndex;
		const isForwardPrefetch =
			state.direction !== "backward" &&
			rowIndex > state.endIndex &&
			rowIndex <= state.endIndex + ELEMENT_PREFETCH_ROWS;
		const isBackwardPrefetch =
			state.direction === "backward" &&
			rowIndex < state.startIndex &&
			rowIndex >= state.startIndex - ELEMENT_PREFETCH_ROWS;
		const isPrefetch = isForwardPrefetch || isBackwardPrefetch;

		return {
			// The element virtualizer already bounds the DOM to the visible range
			// plus a small directional buffer. Keep every mounted row loadable:
			// during navigation restoration the virtualizer can report the previous
			// range for one frame, and disabling those rows leaves the viewport blank
			// when the user scrolls again.
			enabled: true,
			fetchpriority:
				isVisible && mediaIndex < INITIAL_HIGH_PRIORITY_MEDIA
					? "high"
					: isPrefetch
						? "low"
						: undefined,
			loading: "eager",
		};
	};
	const createElementImageLoadPolicy = (
		rowIndex: number,
		mediaIndex: number,
	): MediaGridImageLoadPolicy => ({
		get enabled() {
			return resolveElementImageLoadPolicy(rowIndex, mediaIndex).enabled;
		},
		get fetchpriority() {
			return resolveElementImageLoadPolicy(rowIndex, mediaIndex).fetchpriority;
		},
		get loading() {
			return resolveElementImageLoadPolicy(rowIndex, mediaIndex).loading;
		},
	});

	const resolveScrollElement = () =>
		props.scrollMode === "element"
			? (mediaGridRef?.closest("[data-media-scroll]") as HTMLElement | null)
			: null;

	const updateMediaGridMetrics = () => {
		if (!mediaGridRef) return;
		const gridRect = mediaGridRef.getBoundingClientRect();
		setMediaGridWidth(gridRect.width);
		const resolvedScrollElement = resolveScrollElement();
		if (resolvedScrollElement !== scrollElement()) {
			setScrollElement(resolvedScrollElement);
		}
		const scroller = resolvedScrollElement;
		setScrollMargin(
			props.scrollMode === "element" && scroller
				? gridRect.top -
						scroller.getBoundingClientRect().top +
						scroller.scrollTop
				: gridRect.top + window.scrollY,
		);
	};
	const scheduleMediaGridMetrics = () => {
		if (metricsFrameId !== undefined) return;
		metricsFrameId = requestAnimationFrame(() => {
			metricsFrameId = undefined;
			updateMediaGridMetrics();
		});
	};

	onMount(() => {
		setWindowWidth(window.innerWidth);
		setScrollElement(resolveScrollElement());
		updateMediaGridMetrics();

		const handleResize = () => {
			setWindowWidth(window.innerWidth);
		};
		window.addEventListener("resize", handleResize);

		const resizeObserver = new ResizeObserver(scheduleMediaGridMetrics);
		if (mediaGridRef) {
			resizeObserver.observe(mediaGridRef);
		}

		onCleanup(() => {
			window.removeEventListener("resize", handleResize);
			if (metricsFrameId !== undefined) {
				cancelAnimationFrame(metricsFrameId);
				metricsFrameId = undefined;
			}
			resizeObserver.disconnect();
		});
	});

	createEffect(() => {
		rowCount();
		mediaItemHeight();
		columnCount();
		// The element virtualizer is created before the grid's mount callback
		// discovers its nested scroller. Re-measure when that scroller or the
		// content offset becomes available so the initial range is populated
		// without requiring a user scroll event.
		scrollElement();
		scrollMargin();
		const virtualizer = mediaRowVirtualizer();
		virtualizer.measure();
		const element = scrollElement();
		if (props.scrollMode === "element" && element) {
			// Element scroll containers do not consistently emit a native scroll
			// event when their content is replaced or clamped. Window scrolling in
			// the v1 screen gets that notification from the browser automatically.
			// Dispatching lets the virtualizer read the element's current offset
			// without imperatively writing a possibly stale offset back to it.
			element.dispatchEvent(new Event("scroll"));
		}
	});

	// Virtual scroll-based load more: trigger when user scrolls near the end
	createEffect(() => {
		if (!shouldVirtualize()) return;
		const totalRows = rowCount();
		const handleScroll = () => {
			if (!props.hasNextPage || props.isFetchingNextPage) return;
			const lastItem = mediaRowVirtualizer().getVirtualItems().at(-1);
			if (lastItem && lastItem.index >= totalRows - LOAD_MORE_ROWS_AHEAD) {
				props.onLoadMore?.();
			}
		};
		const target = props.scrollMode === "element" ? scrollElement() : window;
		if (!target) return;
		target.addEventListener("scroll", handleScroll, { passive: true });
		onCleanup(() => target.removeEventListener("scroll", handleScroll));
	});

	const contextMenuMediaId = () => props.contextMenuMediaId?.() ?? null;

	const onContextMenuHandler = (mediaId: string) => {
		return () => {
			props.setContextMenuMediaId?.(mediaId);
		};
	};

	const gridContent = (
		<div
			class="@container relative min-w-0 w-full"
			ref={(element) => {
				mediaGridRef = element;
				scheduleMediaGridMetrics();
			}}
			style={{
				height: shouldVirtualize()
					? `${mediaRowVirtualizer().getTotalSize()}px`
					: undefined,
			}}
		>
			<Show
				fallback={
					<Show
						fallback={
							<MediaGridSkeleton
								aspectRatio={
									props.scrollMode === "element"
										? props.itemAspectRatio === 4 / 3
											? "4/3"
											: "3/4"
										: undefined
								}
								count={columnCount() * INITIAL_SKELETON_ROWS}
							/>
						}
						when={!virtualizationPending()}
					>
						<div class={mediaGridClassName} data-media-grid>
							<For each={props.mediaResults()}>
								{(media, index) =>
									props.renderItem(media, {
										imageLoadPolicy:
											props.scrollMode === "element"
												? {
														enabled: true,
														fetchpriority:
															index() < INITIAL_HIGH_PRIORITY_MEDIA
																? "high"
																: undefined,
														loading:
															index() < initialPriorityMediaCount()
																? "eager"
																: "lazy",
													}
												: undefined,
										onContextMenu: onContextMenuHandler(media.id),
										priority:
											props.scrollMode === "element"
												? index() < initialPriorityMediaCount()
												: undefined,
										get isBulkSelectMode() {
											return props.isBulkSelectMode?.();
										},
										get isSelected() {
											return props.isSelected?.(media.id);
										},
										onPreviewSelect: createMediaPreviewSelectHandler(
											media,
											props.onPreviewSelect,
										),
										get isPreviewSelected() {
											return props.previewSelectedMediaId?.() === media.id;
										},
									})
								}
							</For>
						</div>
					</Show>
				}
				when={shouldVirtualize()}
			>
				<For each={mediaRowVirtualizer().getVirtualItems()}>
					{(virtualRow) => {
						const rowMedia = () => getRowMedia(virtualRow.index);
						return (
							<div
								class={`absolute top-0 left-0 ${mediaGridClassName}`}
								style={{
									"grid-template-columns": `repeat(${columnCount()}, minmax(0, 1fr))`,
									height: `${virtualRow.size}px`,
									transform: `translateY(${
										virtualRow.start -
										mediaRowVirtualizer().options.scrollMargin
									}px)`,
									width: "100%",
								}}
							>
								<For each={rowMedia()}>
									{(media, mediaIndexInRow) =>
										props.renderItem(media, {
											imageLoadPolicy:
												props.scrollMode === "element"
													? createElementImageLoadPolicy(
															virtualRow.index,
															virtualRow.index * columnCount() +
																mediaIndexInRow(),
														)
													: undefined,
											onContextMenu: onContextMenuHandler(media.id),
											// Window virtualization keeps its established native lazy-loading
											// behavior. Element mode supplies a separate direction-aware policy.
											priority:
												props.scrollMode === "element" &&
												virtualRow.index < INITIAL_PRIORITY_ROWS,
											get isBulkSelectMode() {
												return props.isBulkSelectMode?.();
											},
											get isSelected() {
												return props.isSelected?.(media.id);
											},
											onPreviewSelect: createMediaPreviewSelectHandler(
												media,
												props.onPreviewSelect,
											),
											get isPreviewSelected() {
												return props.previewSelectedMediaId?.() === media.id;
											},
										})
									}
								</For>
							</div>
						);
					}}
				</For>
			</Show>
		</div>
	);

	return (
		<div class="min-h-0 min-w-0 space-y-4">
			<Switch>
				<Match when={props.state().phase === "pending"}>
					<LoadingRegion label="メディア一覧を読み込んでいます...">
						<MediaGridSkeleton
							aspectRatio={
								props.scrollMode === "element"
									? props.itemAspectRatio === 4 / 3
										? "4/3"
										: "3/4"
									: undefined
							}
						/>
					</LoadingRegion>
				</Match>
				<Match when={props.state().phase === "error"}>
					<ErrorState
						description={errorMessage()}
						onRetry={props.onRetry}
						title={props.errorTitle ?? "メディア一覧を読み込めませんでした"}
					/>
				</Match>
				<Match when={props.state().phase === "offline"}>
					<OfflineState
						description="接続を確認してから再試行してください。"
						onRetry={props.onRetry}
					/>
				</Match>
				<Match
					when={
						props.state().phase === "data" || props.state().phase === "empty"
					}
				>
					{/* Result count */}
					<Show when={showResultCount() && props.mediaResults().length > 0}>
						<div class="mb-4 flex min-w-0 items-center justify-between gap-3">
							<p class="text-gray-600 text-sm">{totalCount()} 件の結果</p>
						</div>
					</Show>

					{/* Grid with optional context menu */}
					<Show fallback={gridContent} when={!disableContextMenu()}>
						<ContextMenu>
							<ContextMenuTrigger class="block min-w-0 w-full">
								{gridContent}
							</ContextMenuTrigger>
							<ContextMenuContent>
								<Show
									fallback={
										<ContextMenuItem disabled>
											No media selected
										</ContextMenuItem>
									}
									when={contextMenuMediaId()}
								>
									<ContextMenuItem
										onSelect={() => {
											const id = contextMenuMediaId();
											if (id) props.onToggleSelect?.(id);
										}}
									>
										{(() => {
											const id = contextMenuMediaId();
											return id &&
												props.isBulkSelectMode?.() &&
												props.isSelected?.(id)
												? "選択解除"
												: "選択";
										})()}
									</ContextMenuItem>

									<ContextMenuSeparator />

									<Show
										when={
											props.isBulkSelectMode?.() &&
											(props.selectedCount?.() ?? 0) > 0
										}
									>
										<ContextMenuItem
											onSelect={() => {
												props.onBulkAction?.();
											}}
										>
											一括操作を実行 ({props.selectedCount?.()}件選択中)
										</ContextMenuItem>
										<ContextMenuItem
											onSelect={() => {
												props.onClearSelection?.();
											}}
										>
											選択をクリア
										</ContextMenuItem>
										<ContextMenuSeparator />
									</Show>

									<Show when={showOpenInNewTab()}>
										<ContextMenuItem
											onSelect={() => {
												const id = contextMenuMediaId();
												const sourceId = props.mediaSourceId();
												if (id && sourceId) {
													window.open(
														`${props.detailBasePath ?? "/sources"}/${sourceId}/${id}`,
														"_blank",
													);
												}
											}}
										>
											新しいタブで開く
										</ContextMenuItem>
									</Show>

									<ContextMenuItem
										class="text-red-600 focus:text-red-600"
										onSelect={() => {
											const id = contextMenuMediaId();
											if (id) props.onDelete?.(id);
										}}
									>
										削除
									</ContextMenuItem>

									<ContextMenuSeparator />

									<ContextMenuItem
										onSelect={() => {
											const id = contextMenuMediaId();
											if (id) props.onCopyMove?.(id, "copy");
										}}
									>
										他のソースへコピー
									</ContextMenuItem>
									<ContextMenuItem
										onSelect={() => {
											const id = contextMenuMediaId();
											if (id) props.onCopyMove?.(id, "move");
										}}
									>
										他のソースへ移動
									</ContextMenuItem>

									<ContextMenuSeparator />

									<ContextMenuItem
										onSelect={() => {
											const id = contextMenuMediaId();
											if (id) props.onSyncSingleMedia?.(id);
										}}
									>
										メタデータを同期 (再処理)
									</ContextMenuItem>
								</Show>
							</ContextMenuContent>
						</ContextMenu>
					</Show>

					{/* Empty state */}
					<Show when={showEmptyState() && props.state().phase === "empty"}>
						<EmptyState
							description="検索条件を変更して、もう一度お試しください。"
							title="検索結果が見つかりませんでした"
						/>
					</Show>

					{/* Load more sentinel */}
					<div
						aria-live="polite"
						class="flex min-h-11 w-full items-center justify-center py-2 text-gray-500 text-sm"
						data-testid="media-load-more-sentinel"
						ref={props.setLoadMoreRef}
						role="status"
					>
						<Show
							fallback={
								<Show when={props.hasNextPage}>
									<p>スクロールしてさらに読み込む</p>
								</Show>
							}
							when={props.isFetchingNextPage}
						>
							<p>読み込み中...</p>
						</Show>
					</div>
				</Match>
			</Switch>
		</div>
	);
}
