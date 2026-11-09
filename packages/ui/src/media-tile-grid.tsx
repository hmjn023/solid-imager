import {
	createVirtualizer,
	createWindowVirtualizer,
	type Range,
	type Virtualizer,
} from "@tanstack/solid-virtual";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
	untrack,
	type JSX,
} from "solid-js";
import type { MediaGridImageLoadPolicy } from "./media-grid-item";
import {
	getMediaGridColumnCount,
	MediaGridSkeleton,
	mediaGridClassName,
} from "./skeleton";
import {
	getCollectionNavigationIndex,
	isCollectionNavigationKey,
} from "./workspace/collection-navigation";

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
const INITIAL_SKELETON_ROWS = 3;
const FOCUS_RESTORE_FRAME_LIMIT = 6;

export const HIGH_PRIORITY_THUMBNAILS = 2;

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

export type MediaGridAnchor<Id> = { id: Id; offset: number };

export type MediaGridHandle<Id> = {
	getAnchor: () => MediaGridAnchor<Id> | undefined;
	restoreAnchor: (anchor: MediaGridAnchor<Id>) => Promise<boolean>;
	focusItem: (id: Id) => Promise<boolean>;
};

type TileGridProps<T extends { id: string | number }> = {
	items: readonly T[];
	itemAspectRatio?: number;
	scrollMode?: "element" | "window";
	enableVirtualization?: boolean;
	eagerCount?: number;
	ariaLabel?: string;
	onNavigate?: (item: T) => void;
	onDelete?: (id: T["id"]) => void;
	onReady?: (handle: MediaGridHandle<T["id"]> | undefined) => void;
	onNearEnd?: () => void;
	renderItem: (
		item: T,
		imageLoadPolicy?: MediaGridImageLoadPolicy,
		priority?: boolean,
	) => JSX.Element;
};

/** Responsive collection grid. Long collections render only the visible and prefetched rows. */
export function MediaTileGrid<T extends { id: string | number }>(
	props: TileGridProps<T>,
) {
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
	let mediaGridRef: HTMLElement | undefined;
	let mediaGridResizeObserver: ResizeObserver | undefined;
	let metricsFrameId: number | undefined;
	let focusRequest = 0;
	let disposed = false;

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
		return columns > 0 ? Math.ceil(props.items.length / columns) : 0;
	});
	const getRowMedia = (rowIndex: number) => {
		const columns = columnCount();
		if (columns <= 0) return [];
		const results = props.items;
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
		get enabled() {
			return props.scrollMode === "element" && scrollElement() !== null;
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
	const measuredVirtualRows = () => mediaRowVirtualizer().getVirtualItems();

	// Reserve the full extent as soon as the grid is measurable. If the layout
	// waits for virtual rows, crossing the threshold can collapse the scroller
	// to the skeleton height before its observer publishes the first range.
	const shouldVirtualize = createMemo(
		() =>
			props.enableVirtualization &&
			props.items.length > VIRTUALIZATION_THRESHOLD &&
			mediaItemWidth() > 0,
	);
	const virtualizationPending = createMemo(
		() =>
			props.enableVirtualization &&
			props.items.length > VIRTUALIZATION_THRESHOLD &&
			!shouldVirtualize(),
	);
	const rowStride = () => mediaItemHeight() + GRID_GAP_PX;
	const totalVirtualHeight = () => rowCount() * rowStride() - GRID_GAP_PX;

	// While the virtualizer attaches to a new scroll container, display the
	// estimated viewport at its real scroll position instead of blanking it.
	const [firstRow, setFirstRow] = createSignal(0);
	const [viewportHeight, setViewportHeight] = createSignal(0);
	createEffect(() => {
		if (!shouldVirtualize() || measuredVirtualRows().length) return;
		const element = props.scrollMode === "element" ? scrollElement() : null;
		const target = element ?? window;
		const updateRange = () => {
			const offset = (element?.scrollTop ?? window.scrollY) - scrollMargin();
			setFirstRow(Math.max(0, Math.floor(offset / rowStride())));
			setViewportHeight(element?.clientHeight ?? window.innerHeight);
		};
		updateRange();
		target.addEventListener("scroll", updateRange, { passive: true });
		onCleanup(() => target.removeEventListener("scroll", updateRange));
	});
	const visibleRows = createMemo(() => {
		const measured = measuredVirtualRows();
		if (measured.length || !shouldVirtualize()) return measured;
		const start = Math.max(
			0,
			Math.min(firstRow(), rowCount() - 1) - ELEMENT_RETAIN_ROWS,
		);
		const end = Math.min(
			rowCount(),
			firstRow() +
				Math.ceil(viewportHeight() / rowStride()) +
				ELEMENT_PREFETCH_ROWS +
				1,
		);
		return Array.from({ length: Math.max(0, end - start) }, (_, i) => ({
			index: start + i,
			size: mediaItemHeight(),
			start: scrollMargin() + (start + i) * rowStride(),
		}));
	});
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
					mediaIndex < HIGH_PRIORITY_THUMBNAILS ? "high" : undefined,
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
				isVisible && mediaIndex < HIGH_PRIORITY_THUMBNAILS
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
		const element = mediaGridRef?.closest("[data-media-scroll]");
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
			untrack(() => element.dispatchEvent(new Event("scroll")));
		}
	});

	// The visible range and the network request are independent of thumbnail prefetch.
	createEffect(() => {
		const onNearEnd = props.onNearEnd;
		if (!shouldVirtualize() || !onNearEnd) return;
		const rows = rowCount();
		const handleScroll = () => {
			const last = visibleRows().at(-1);
			if (last && last.index >= rows - LOAD_MORE_ROWS_AHEAD) onNearEnd();
		};
		const target = props.scrollMode === "element" ? scrollElement() : window;
		target?.addEventListener("scroll", handleScroll, { passive: true });
		onCleanup(() => target?.removeEventListener("scroll", handleScroll));
	});

	const tileElement = (id: T["id"]) =>
		mediaGridRef?.querySelector<HTMLElement>(
			`[data-media-id="${CSS.escape(String(id))}"]`,
		);

	const rowOffset = (index: number) =>
		Math.floor(index / columnCount()) * rowStride();

	function getAnchor(): MediaGridAnchor<T["id"]> | undefined {
		const area = scrollElement();
		if (!area || !mediaGridRef || !mediaItemHeight() || !props.items.length)
			return;
		// Read the current top: search notices and a previous-page control can
		// change the grid's offset without resizing the grid itself.
		const gridTop =
			mediaGridRef.getBoundingClientRect().top -
			area.getBoundingClientRect().top;
		let row = Math.max(0, Math.floor(-gridTop / rowStride()));
		if (-gridTop - row * rowStride() >= mediaItemHeight()) row++;
		const index = Math.min(row, rowCount() - 1) * columnCount();
		return { id: props.items[index].id, offset: gridTop + rowOffset(index) };
	}

	// Browser layout or a virtual range can still be pending the first frame after
	// mounting. Resolve to false on removal, so a superseded route cannot steal focus.
	const nextPaint = () =>
		new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
	async function restoreAnchor(anchor: MediaGridAnchor<T["id"]>) {
		for (
			let attempt = 0;
			attempt <= FOCUS_RESTORE_FRAME_LIMIT && !disposed;
			attempt++
		) {
			const index = props.items.findIndex((item) => item.id === anchor.id);
			if (index < 0) return false;
			updateMediaGridMetrics();
			const area = scrollElement();
			if (area && mediaItemHeight() > 0 && !virtualizationPending()) {
				const viewportTop = area.getBoundingClientRect().top;
				const tile = tileElement(anchor.id);
				const target = tile
					? area.scrollTop + tile.getBoundingClientRect().top - viewportTop
					: scrollMargin() + rowOffset(index);
				area.scrollTop = target - anchor.offset;
				area.dispatchEvent(new Event("scroll"));
				return true;
			}
			await nextPaint();
		}
		return false;
	}

	async function focusItem(id: T["id"]) {
		const request = ++focusRequest;
		for (
			let attempt = 0;
			attempt <= FOCUS_RESTORE_FRAME_LIMIT &&
			!disposed &&
			request === focusRequest;
			attempt++
		) {
			const index = props.items.findIndex((item) => item.id === id);
			if (index < 0) return false;
			const tile = tileElement(id);
			if (tile) {
				const viewport = scrollElement()?.getBoundingClientRect();
				const rect = tile.getBoundingClientRect();
				if (
					rect.bottom <= (viewport?.top ?? 0) ||
					rect.top >= (viewport?.bottom ?? window.innerHeight)
				) {
					tile.scrollIntoView({ block: "nearest", inline: "nearest" });
				}
				tile.focus({ preventScroll: true });
				return true;
			}
			if (shouldVirtualize()) {
				if (measuredVirtualRows().length) {
					mediaRowVirtualizer().scrollToIndex(
						Math.floor(index / columnCount()),
						{ align: "auto" },
					);
				} else {
					const target =
						props.scrollMode === "element" ? scrollElement() : window;
					target?.scrollTo({ top: scrollMargin() + rowOffset(index) });
					target?.dispatchEvent(new Event("scroll"));
				}
			}
			await nextPaint();
		}
		return false;
	}

	onMount(() => props.onReady?.({ getAnchor, restoreAnchor, focusItem }));
	onCleanup(() => {
		disposed = true;
		props.onReady?.(undefined);
	});

	const navigate: JSX.EventHandler<HTMLElement, KeyboardEvent> = (event) => {
		if (
			event.defaultPrevented ||
			event.isComposing ||
			event.altKey ||
			event.ctrlKey ||
			event.metaKey
		)
			return;
		if (
			!(event.target instanceof HTMLElement) ||
			!event.target.matches("[data-media-id]")
		)
			return;
		const focusedId = event.target.dataset.mediaId;
		const current = props.items.findIndex(
			(item) => String(item.id) === focusedId,
		);
		if (current < 0) return;
		if (event.key === "Delete" && !event.shiftKey && props.onDelete) {
			event.preventDefault();
			if (!event.repeat) props.onDelete(props.items[current].id);
			return;
		}
		if (!isCollectionNavigationKey(event.key)) return;
		const viewportHeight = scrollElement()?.clientHeight ?? window.innerHeight;
		const next = getCollectionNavigationIndex({
			columnCount: columnCount(),
			currentIndex: current,
			itemCount: props.items.length,
			key: event.key,
			pageRowCount: Math.floor(viewportHeight / rowStride()),
		});
		if (next === null) return;
		event.preventDefault();
		props.onNavigate?.(props.items[next]);
		void focusItem(props.items[next].id);
	};

	return (
		// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Delegated navigation for the focused tile links/buttons.
		<section
			class="@container relative min-w-0 w-full"
			classList={{ "virtualized-media-grid": shouldVirtualize() }}
			aria-label={props.ariaLabel ?? "メディアグリッド"}
			data-media-grid
			onKeyDown={navigate}
			ref={(element) => {
				mediaGridRef = element;
				mediaGridResizeObserver?.observe(element);
				scheduleMediaGridMetrics();
			}}
			style={{
				"--media-grid-height": shouldVirtualize()
					? `${totalVirtualHeight()}px`
					: undefined,
			}}
		>
			<Show
				when={!virtualizationPending()}
				fallback={
					<MediaGridSkeleton
						aspectRatio={props.itemAspectRatio === 4 / 3 ? "4/3" : "3/4"}
						count={columnCount() * INITIAL_SKELETON_ROWS}
					/>
				}
			>
				<Show
					when={shouldVirtualize()}
					fallback={
						<div class={mediaGridClassName}>
							<For each={props.items}>
								{(item, index) => {
									const eager = () =>
										index() < (props.eagerCount ?? initialPriorityMediaCount());
									const policy: MediaGridImageLoadPolicy | undefined =
										props.scrollMode === "element"
											? {
													enabled: true,
													get fetchpriority() {
														return index() < HIGH_PRIORITY_THUMBNAILS
															? "high"
															: undefined;
													},
													get loading() {
														return eager() ? "eager" : "lazy";
													},
												}
											: undefined;
									return props.renderItem(
										item,
										policy,
										policy ? eager() : undefined,
									);
								}}
							</For>
						</div>
					}
				>
					<For each={visibleRows()}>
						{(row) => (
							<div
								class={`absolute top-0 left-0 w-full ${mediaGridClassName} virtualized-media-row`}
								style={{
									"--media-grid-columns": columnCount(),
									"--media-grid-row-height": `${row.size}px`,
									"--media-grid-row-offset": `${row.start - scrollMargin()}px`,
								}}
							>
								<For each={getRowMedia(row.index)}>
									{(item, index) =>
										props.renderItem(
											item,
											props.scrollMode === "element"
												? createElementImageLoadPolicy(
														row.index,
														row.index * columnCount() + index(),
													)
												: undefined,
											props.scrollMode === "element" &&
												row.index < INITIAL_PRIORITY_ROWS,
										)
									}
								</For>
							</div>
						)}
					</For>
				</Show>
			</Show>
		</section>
	);
}
