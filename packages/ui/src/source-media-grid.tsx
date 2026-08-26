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
	ContextMenuGroupLabel,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuTrigger,
} from "./context-menu";
import type { MediaCollectionSelectionMode } from "./hooks/use-media-collection-selection";
import type { MediaGridImageLoadPolicy } from "./media-grid-item";
import { createMediaPreviewSelectHandler } from "./media-preview-selection";
import type { QueryUiState } from "./query-state";
import {
	getMediaGridColumnCount,
	LoadingRegion,
	MediaGridSkeleton,
	mediaGridClassName,
} from "./skeleton";
import {
	findCollectionItemById,
	getCollectionNavigationIndex,
	isCollectionNavigationKey,
	isCollectionScrollNearEnd,
} from "./v2/collection-navigation";

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
const LIST_LOAD_MORE_THRESHOLD_PX = 480;
const FOCUS_RESTORE_FRAME_LIMIT = 6;

export type SourceMediaViewMode = "grid" | "list";

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
	/** Applies plain, additive, and range selection gestures. */
	onSelectMedia?: (mediaId: string, mode: MediaCollectionSelectionMode) => void;
	previewSelectedMediaId?: Accessor<string | null>;
	/** Render a single media grid item. */
	renderItem: (
		media: Media,
		options: {
			imageLoadPolicy?: MediaGridImageLoadPolicy;
			onContextMenu: () => void;
			onOpenMediaDetail?: () => void;
			priority?: boolean;
			isBulkSelectMode?: boolean;
			isSelected?: boolean;
			onPreviewSelect?: () => void;
			onSelectGesture?: (event: MouseEvent | KeyboardEvent) => void;
			onToggleSelect?: () => void;
			onPrepareMediaDetail?: () => void;
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
	/** Optional collection presentation mode. */
	viewMode?: Accessor<SourceMediaViewMode>;
	/** Opens the media detail route from list rows. */
	onOpenMediaDetail?: (media: Media) => void;
	/** Saves the current collection context before a direct card navigation. */
	onPrepareMediaDetail?: (media: Media) => void;
};

export function SourceMediaGrid(props: SourceMediaGridProps) {
	const showResultCount = () => props.showResultCount ?? true;
	const showEmptyState = () => props.showEmptyState ?? true;
	const showOpenInNewTab = () => props.showOpenInNewTab ?? true;
	const enableVirtualization = () => props.enableVirtualization ?? false;
	const disableContextMenu = () => props.disableContextMenu ?? false;
	const totalCount = () => props.totalCount ?? props.mediaResults().length;
	const selectionModeFromEvent = (
		event: MouseEvent | KeyboardEvent,
	): MediaCollectionSelectionMode => {
		const additive = event.metaKey || event.ctrlKey;
		if (event.shiftKey) return additive ? "additive-range" : "range";
		return additive ? "toggle" : "replace";
	};
	const selectFromGesture = (
		media: Media,
		event: MouseEvent | KeyboardEvent,
	) => {
		props.onSelectMedia?.(media.id, selectionModeFromEvent(event));
		props.onPreviewSelect?.(media);
	};
	const viewMode = () => props.viewMode?.() ?? "grid";
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
	const [activeMediaId, setActiveMediaId] = createSignal<string | null>(null);
	const [internalContextMenuMedia, setInternalContextMenuMedia] =
		createSignal<Media>();
	let collectionRootRef: HTMLDivElement | undefined;
	let mediaGridRef: HTMLElement | undefined;
	let mediaGridResizeObserver: ResizeObserver | undefined;
	let metricsFrameId: number | undefined;
	let focusFrameId: number | undefined;
	let listLoadRequestPending = false;
	let listLoadRequestCount = -1;
	let listLoadWasFetching = false;

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

	const resolveScrollElement = () => {
		if (props.scrollMode !== "element") return null;
		const element = collectionRootRef?.closest("[data-media-scroll]");
		return element instanceof HTMLElement ? element : null;
	};

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
		mediaGridResizeObserver = resizeObserver;
		if (mediaGridRef) {
			resizeObserver.observe(mediaGridRef);
		}

		onCleanup(() => {
			window.removeEventListener("resize", handleResize);
			if (metricsFrameId !== undefined) {
				cancelAnimationFrame(metricsFrameId);
				metricsFrameId = undefined;
			}
			if (focusFrameId !== undefined) {
				cancelAnimationFrame(focusFrameId);
				focusFrameId = undefined;
			}
			resizeObserver.disconnect();
			if (mediaGridResizeObserver === resizeObserver) {
				mediaGridResizeObserver = undefined;
			}
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
		if (!shouldVirtualize() || viewMode() !== "grid") return;
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

	createEffect(() => {
		const fetching = props.isFetchingNextPage;
		const resultCount = props.mediaResults().length;
		if (fetching) {
			listLoadWasFetching = true;
			return;
		}
		if (listLoadWasFetching || resultCount !== listLoadRequestCount) {
			listLoadRequestPending = false;
			listLoadWasFetching = false;
		}
	});

	createEffect(() => {
		if (viewMode() !== "list") return;
		const target = props.scrollMode === "element" ? scrollElement() : window;
		if (!target) return;

		const handleScroll = () => {
			if (
				!props.hasNextPage ||
				props.isFetchingNextPage ||
				!props.onLoadMore ||
				listLoadRequestPending
			) {
				return;
			}

			const metrics =
				target instanceof HTMLElement
					? {
							contentSize: target.scrollHeight,
							scrollOffset: target.scrollTop,
							viewportSize: target.clientHeight,
						}
					: {
							contentSize: document.documentElement.scrollHeight,
							scrollOffset: window.scrollY,
							viewportSize: window.innerHeight,
						};
			if (
				!isCollectionScrollNearEnd({
					...metrics,
					threshold: LIST_LOAD_MORE_THRESHOLD_PX,
				})
			) {
				return;
			}

			listLoadRequestPending = true;
			listLoadRequestCount = props.mediaResults().length;
			props.onLoadMore();
		};

		target.addEventListener("scroll", handleScroll, { passive: true });
		const frameId = requestAnimationFrame(handleScroll);
		onCleanup(() => {
			cancelAnimationFrame(frameId);
			target.removeEventListener("scroll", handleScroll);
		});
	});

	const contextMenuMedia = () => {
		const mediaId =
			internalContextMenuMedia()?.id ?? props.contextMenuMediaId?.() ?? null;
		return findCollectionItemById(props.mediaResults(), mediaId);
	};

	const clearContextMenuTarget = () => {
		setInternalContextMenuMedia(undefined);
		props.setContextMenuMediaId?.(null);
	};

	const setContextMenuTarget = (media: Media | undefined) => {
		if (!media) {
			clearContextMenuTarget();
			return;
		}
		const shouldNotifyPreview = internalContextMenuMedia()?.id !== media.id;
		setInternalContextMenuMedia(media);
		props.setContextMenuMediaId?.(media.id);
		setActiveMediaId(media.id);
		if (shouldNotifyPreview) {
			props.onPreviewSelect?.(media);
		}
	};

	const onContextMenuHandler = (media: Media) => {
		return () => {
			setContextMenuTarget(media);
		};
	};

	const findMediaFromEventTarget = (target: EventTarget | null) => {
		if (!(target instanceof Element)) return undefined;
		const mediaId =
			target.closest<HTMLElement>("[data-media-id]")?.dataset.mediaId;
		return findCollectionItemById(props.mediaResults(), mediaId);
	};

	const findRenderedMediaElement = (mediaId: string) =>
		Array.from(
			mediaGridRef?.querySelectorAll<HTMLElement>("[data-media-id]") ?? [],
		).find((element) => element.dataset.mediaId === mediaId);

	const focusRenderedMedia = (mediaId: string, attempt = 0) => {
		const element = findRenderedMediaElement(mediaId);
		if (element) {
			focusFrameId = undefined;
			element.focus({ preventScroll: true });
			return;
		}
		if (attempt >= FOCUS_RESTORE_FRAME_LIMIT) {
			focusFrameId = undefined;
			return;
		}
		focusFrameId = requestAnimationFrame(() => {
			focusRenderedMedia(mediaId, attempt + 1);
		});
	};

	const visiblePageRowCount = () => {
		const viewportHeight =
			props.scrollMode === "element"
				? scrollElement()?.clientHeight
				: window.innerHeight;
		const rowHeight = mediaItemHeight() + GRID_GAP_PX;
		if (!viewportHeight || rowHeight <= 0) return 1;
		return Math.max(Math.floor(viewportHeight / rowHeight), 1);
	};

	const handleGridKeyDown: JSX.EventHandler<HTMLElement, KeyboardEvent> = (
		event,
	) => {
		if (!isCollectionNavigationKey(event.key)) return;
		if (
			event.target instanceof HTMLInputElement ||
			event.target instanceof HTMLTextAreaElement ||
			event.target instanceof HTMLSelectElement
		) {
			return;
		}

		const results = props.mediaResults();
		if (results.length === 0) return;
		const focusedMedia = findMediaFromEventTarget(event.target);
		const currentMediaId =
			focusedMedia?.id ??
			activeMediaId() ??
			props.previewSelectedMediaId?.() ??
			results[0]?.id;
		const currentIndex = Math.max(
			results.findIndex((media) => media.id === currentMediaId),
			0,
		);
		const nextIndex = getCollectionNavigationIndex({
			columnCount: columnCount(),
			currentIndex,
			itemCount: results.length,
			key: event.key,
			pageRowCount: visiblePageRowCount(),
		});
		if (nextIndex === null) return;
		const nextMedia = results[nextIndex];
		if (!nextMedia) return;

		event.preventDefault();
		setActiveMediaId(nextMedia.id);
		props.onPreviewSelect?.(nextMedia);
		if (shouldVirtualize()) {
			mediaRowVirtualizer().scrollToIndex(
				Math.floor(nextIndex / Math.max(columnCount(), 1)),
				{ align: "auto" },
			);
		}
		if (focusFrameId !== undefined) cancelAnimationFrame(focusFrameId);
		focusRenderedMedia(nextMedia.id);
	};

	const gridContent = (
		<section
			class="@container relative min-w-0 w-full"
			aria-label="メディア一覧"
			onFocusIn={(event) => {
				const media = findMediaFromEventTarget(event.target);
				if (media) setActiveMediaId(media.id);
			}}
			onKeyDown={handleGridKeyDown}
			ref={(element) => {
				if (mediaGridRef && mediaGridRef !== element) {
					mediaGridResizeObserver?.unobserve(mediaGridRef);
				}
				mediaGridRef = element;
				mediaGridResizeObserver?.observe(element);
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
										onContextMenu: onContextMenuHandler(media),
										onOpenMediaDetail: props.onOpenMediaDetail
											? () => props.onOpenMediaDetail?.(media)
											: undefined,
										onPrepareMediaDetail: () =>
											props.onPrepareMediaDetail?.(media),
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
										onToggleSelect: props.onToggleSelect
											? () => props.onToggleSelect?.(media.id)
											: undefined,
										onPreviewSelect: createMediaPreviewSelectHandler(
											media,
											props.onPreviewSelect,
										),
										onSelectGesture: props.onSelectMedia
											? (event) => selectFromGesture(media, event)
											: undefined,
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
											onContextMenu: onContextMenuHandler(media),
											onOpenMediaDetail: props.onOpenMediaDetail
												? () => props.onOpenMediaDetail?.(media)
												: undefined,
											onPrepareMediaDetail: () =>
												props.onPrepareMediaDetail?.(media),
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
											onToggleSelect: props.onToggleSelect
												? () => props.onToggleSelect?.(media.id)
												: undefined,
											onPreviewSelect: createMediaPreviewSelectHandler(
												media,
												props.onPreviewSelect,
											),
											onSelectGesture: props.onSelectMedia
												? (event) => selectFromGesture(media, event)
												: undefined,
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
		</section>
	);
	const formatFileSize = (bytes: number | null): string => {
		if (bytes === null) return "—";
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};
	const listContent = (
		<div class="overflow-x-auto rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface)] [scrollbar-gutter:stable]">
			<table class="w-full min-w-[52rem] border-collapse text-left text-sm">
				<caption class="sr-only">
					メディア一覧。{totalCount().toLocaleString()}件。
				</caption>
				<thead class="bg-[var(--v2-surface-muted)] text-xs text-[var(--v2-text-muted)]">
					<tr>
						<Show when={props.isBulkSelectMode?.()}>
							<th class="w-10 px-3 py-2" scope="col">
								<span class="sr-only">選択</span>
							</th>
						</Show>
						<th class="px-3 py-2 font-medium" scope="col">
							Name
						</th>
						<th class="px-3 py-2 font-medium" scope="col">
							Type
						</th>
						<th class="px-3 py-2 font-medium" scope="col">
							Dimensions
						</th>
						<th class="px-3 py-2 font-medium" scope="col">
							Size
						</th>
						<th class="px-3 py-2 font-medium" scope="col">
							Modified
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-[var(--v2-border)]">
					<For each={props.mediaResults()}>
						{(media) => (
							<tr
								aria-selected={props.previewSelectedMediaId?.() === media.id}
								class={`outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--v2-focus)] ${
									props.isSelected?.(media.id) ||
									props.previewSelectedMediaId?.() === media.id
										? "bg-[var(--v2-surface-selected)]"
										: "hover:bg-[var(--v2-surface-muted)]"
								}`}
								data-media-id={media.id}
								onClick={(event) => {
									if (
										event.target instanceof Element &&
										event.target.closest("[data-collection-row-control]")
									) {
										return;
									}
									setActiveMediaId(media.id);
									if (
										props.onSelectMedia &&
										(event.metaKey || event.ctrlKey || event.shiftKey)
									) {
										event.preventDefault();
										selectFromGesture(media, event);
									} else {
										props.onPreviewSelect?.(media);
									}
									event.currentTarget.focus({ preventScroll: true });
								}}
								onContextMenu={onContextMenuHandler(media)}
								onDblClick={(event) => {
									if (
										event.target instanceof Element &&
										event.target.closest("[data-collection-row-control]")
									) {
										return;
									}
									props.onOpenMediaDetail?.(media);
								}}
								onKeyDown={(event) => {
									if (event.target !== event.currentTarget) return;
									if (event.key === "Enter" && props.onOpenMediaDetail) {
										event.preventDefault();
										props.onOpenMediaDetail(media);
									}
									if (event.key === " ") event.preventDefault();
								}}
								onKeyUp={(event) => {
									if (
										event.target !== event.currentTarget ||
										event.key !== " "
									) {
										return;
									}
									event.preventDefault();
									if (props.onSelectMedia) {
										props.onSelectMedia(media.id, "toggle");
										props.onPreviewSelect?.(media);
									} else if (props.onToggleSelect) {
										props.onToggleSelect(media.id);
									} else {
										props.onPreviewSelect?.(media);
									}
								}}
								tabIndex={
									props.onPreviewSelect ||
									props.onOpenMediaDetail ||
									props.onToggleSelect ||
									props.onSelectMedia
										? 0
										: undefined
								}
							>
								<Show when={props.isBulkSelectMode?.()}>
									<td class="px-3 py-2">
										<input
											aria-label={`${media.fileName}を選択`}
											checked={props.isSelected?.(media.id) ?? false}
											data-collection-row-control
											onChange={() => props.onToggleSelect?.(media.id)}
											onClick={(event) => event.stopPropagation()}
											type="checkbox"
										/>
									</td>
								</Show>
								<th class="max-w-[28rem] px-3 py-2 font-normal" scope="row">
									<div class="min-h-10 w-full px-1 py-1 text-left">
										<span
											class="block truncate font-medium text-[var(--v2-text)]"
											title={media.fileName}
										>
											{media.fileName}
										</span>
										<span
											class="mt-0.5 block truncate text-[var(--v2-text-muted)] text-xs"
											title={media.filePath}
										>
											{media.filePath}
										</span>
									</div>
								</th>
								<td class="px-3 py-2 text-[var(--v2-text-secondary)]">
									{media.mediaType}
								</td>
								<td class="whitespace-nowrap px-3 py-2 text-[var(--v2-text-secondary)]">
									{media.width} × {media.height}
								</td>
								<td class="whitespace-nowrap px-3 py-2 text-[var(--v2-text-secondary)]">
									{formatFileSize(media.fileSize)}
								</td>
								<td class="whitespace-nowrap px-3 py-2 text-[var(--v2-text-muted)]">
									{media.modifiedAt.toLocaleDateString("ja-JP")}
								</td>
							</tr>
						)}
					</For>
				</tbody>
			</table>
		</div>
	);
	const hasContextMenuActions = () =>
		Boolean(
			props.onOpenMediaDetail ||
				props.onToggleSelect ||
				props.onBulkAction ||
				props.onClearSelection ||
				props.onDelete ||
				props.onCopyMove ||
				props.onSyncSingleMedia,
		);
	const openMediaInNewTab = (media: Media) => {
		window.open(
			`${props.detailBasePath ?? "/sources"}/${media.mediaSourceId}/${media.id}`,
			"_blank",
			"noopener,noreferrer",
		);
	};
	const collectionContent = (
		<Show fallback={gridContent} when={viewMode() === "list"}>
			{listContent}
		</Show>
	);

	return (
		<div
			class="min-h-0 min-w-0 space-y-4"
			ref={(element) => {
				collectionRootRef = element;
				const resolvedScrollElement = resolveScrollElement();
				if (resolvedScrollElement !== scrollElement()) {
					setScrollElement(resolvedScrollElement);
				}
			}}
		>
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

					{/* Grid and list share the same target-safe context menu. */}
					<Show fallback={collectionContent} when={!disableContextMenu()}>
						<ContextMenu
							onOpenChange={(open) => {
								if (!open) clearContextMenuTarget();
							}}
						>
							<ContextMenuTrigger
								class="block min-w-0 w-full"
								onPointerDown={(event) => {
									if (event.button === 2) {
										setContextMenuTarget(
											findMediaFromEventTarget(event.target),
										);
									}
								}}
							>
								<section
									class="min-w-0 w-full"
									aria-label="メディア一覧の操作対象"
									onContextMenu={(event) => {
										const media = findMediaFromEventTarget(event.target);
										setContextMenuTarget(media);
										if (!media) {
											event.preventDefault();
											event.stopPropagation();
										}
									}}
								>
									{collectionContent}
								</section>
							</ContextMenuTrigger>
							<ContextMenuContent class="v2-theme min-w-56 max-w-80">
								<Show
									keyed
									fallback={
										<ContextMenuItem disabled>
											メディアを選択してください
										</ContextMenuItem>
									}
									when={contextMenuMedia()}
								>
									{(media) => (
										<>
											<ContextMenuGroupLabel
												class="max-w-72 truncate text-[var(--v2-text-muted)]"
												title={media.fileName}
											>
												{media.fileName}
											</ContextMenuGroupLabel>
											<ContextMenuSeparator />
											<Show when={!hasContextMenuActions()}>
												<ContextMenuItem disabled>
													利用できる操作はありません
												</ContextMenuItem>
											</Show>
											<Show when={props.onOpenMediaDetail}>
												<ContextMenuItem
													onSelect={() => props.onOpenMediaDetail?.(media)}
												>
													詳細を開く
													<ContextMenuShortcut>Enter</ContextMenuShortcut>
												</ContextMenuItem>
											</Show>
											<Show
												when={showOpenInNewTab() && props.onOpenMediaDetail}
											>
												<ContextMenuItem
													onSelect={() => openMediaInNewTab(media)}
												>
													新しいタブで開く
												</ContextMenuItem>
											</Show>
											<Show when={props.onToggleSelect}>
												<ContextMenuItem
													onSelect={() => props.onToggleSelect?.(media.id)}
												>
													{props.isBulkSelectMode?.() &&
													props.isSelected?.(media.id)
														? "選択解除"
														: "選択"}
													<ContextMenuShortcut>Space</ContextMenuShortcut>
												</ContextMenuItem>
											</Show>
											<Show
												when={
													props.isBulkSelectMode?.() &&
													(props.selectedCount?.() ?? 0) > 0 &&
													(props.onBulkAction || props.onClearSelection)
												}
											>
												<Show when={props.onBulkAction}>
													<ContextMenuItem
														onSelect={() => props.onBulkAction?.()}
													>
														一括操作を実行 ({props.selectedCount?.()}件選択中)
													</ContextMenuItem>
												</Show>
												<Show when={props.onClearSelection}>
													<ContextMenuItem
														onSelect={() => props.onClearSelection?.()}
													>
														選択をクリア
													</ContextMenuItem>
												</Show>
											</Show>
											<Show when={props.onDelete}>
												<ContextMenuSeparator />
												<ContextMenuItem
													class="text-destructive focus:text-destructive"
													onSelect={() => props.onDelete?.(media.id)}
												>
													削除
													<ContextMenuShortcut>Delete</ContextMenuShortcut>
												</ContextMenuItem>
											</Show>
											<Show when={props.onCopyMove}>
												<ContextMenuSeparator />
												<ContextMenuItem
													onSelect={() => props.onCopyMove?.(media.id, "copy")}
												>
													他のソースへコピー
												</ContextMenuItem>
												<ContextMenuItem
													onSelect={() => props.onCopyMove?.(media.id, "move")}
												>
													他のソースへ移動
												</ContextMenuItem>
											</Show>
											<Show when={props.onSyncSingleMedia}>
												<ContextMenuSeparator />
												<ContextMenuItem
													onSelect={() => props.onSyncSingleMedia?.(media.id)}
												>
													メタデータを同期 (再処理)
												</ContextMenuItem>
											</Show>
										</>
									)}
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
