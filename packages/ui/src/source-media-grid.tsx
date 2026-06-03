import type { Media } from "@solid-imager/core/domain/media/schemas";
import { createWindowVirtualizer } from "@tanstack/solid-virtual";
import type { Accessor, JSX, Setter } from "solid-js";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "./context-menu";

const VIRTUALIZATION_THRESHOLD = 100;
const GRID_GAP_PX = 16;
const GRID_ITEM_ASPECT_RATIO = 4 / 3;
const VIRTUAL_ROWS_OVERSCAN = 4;

type SourceMediaGridProps = {
	mediaResults: Accessor<Media[]>;
	mediaSourceId: Accessor<string | undefined>;
	isPending: boolean;
	isError: boolean;
	isFetchingNextPage: boolean;
	queryError: Error | null;
	contextMenuMediaId?: Accessor<string | null>;
	setContextMenuMediaId?: Setter<string | null>;
	onDelete?: (mediaId: string) => void;
	onCopyMove?: (mediaId: string, mode: "copy" | "move") => void;
	onSyncSingleMedia?: (mediaId: string) => void;
	setLoadMoreRef: (el: HTMLDivElement) => void;
	/** Render a single media grid item. */
	renderItem: (
		media: Media,
		options: { onContextMenu: () => void },
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
};

export function SourceMediaGrid(props: SourceMediaGridProps) {
	const showResultCount = () => props.showResultCount ?? true;
	const showEmptyState = () => props.showEmptyState ?? true;
	const showOpenInNewTab = () => props.showOpenInNewTab ?? true;
	const enableVirtualization = () => props.enableVirtualization ?? false;
	const disableContextMenu = () => props.disableContextMenu ?? false;
	const totalCount = () => props.totalCount ?? props.mediaResults().length;

	// --- Virtual grid setup ---
	const [windowWidth, setWindowWidth] = createSignal(0);
	const [mediaGridWidth, setMediaGridWidth] = createSignal(0);
	let mediaGridRef: HTMLDivElement | undefined;

	const columnCount = createMemo(() => {
		const width = windowWidth();
		if (width >= 1024) return 5;
		if (width >= 768) return 3;
		return 2;
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
		return width * GRID_ITEM_ASPECT_RATIO;
	});

	const mediaRows = createMemo(() => {
		const results = props.mediaResults();
		const columns = columnCount();
		const rows: Media[][] = [];
		for (let index = 0; index < results.length; index += columns) {
			rows.push(results.slice(index, index + columns));
		}
		return rows;
	});

	const rowCount = createMemo(() => mediaRows().length);

	const mediaRowVirtualizer = createWindowVirtualizer<HTMLDivElement>({
		get count() {
			return rowCount();
		},
		estimateSize: () => mediaItemHeight() || 320,
		gap: GRID_GAP_PX,
		getItemKey: (index) => index,
		overscan: VIRTUAL_ROWS_OVERSCAN,
		scrollMargin: 0,
	});

	const shouldVirtualize = createMemo(
		() =>
			enableVirtualization() &&
			props.mediaResults().length > VIRTUALIZATION_THRESHOLD &&
			mediaItemWidth() > 0,
	);

	const updateMediaGridMetrics = () => {
		if (!mediaGridRef) return;
		setMediaGridWidth(mediaGridRef.getBoundingClientRect().width);
	};

	onMount(() => {
		setWindowWidth(window.innerWidth);
		updateMediaGridMetrics();

		const handleResize = () => {
			setWindowWidth(window.innerWidth);
			updateMediaGridMetrics();
		};
		window.addEventListener("resize", handleResize);

		const resizeObserver = new ResizeObserver(() => {
			updateMediaGridMetrics();
		});
		if (mediaGridRef) {
			resizeObserver.observe(mediaGridRef);
		}

		onCleanup(() => {
			window.removeEventListener("resize", handleResize);
			resizeObserver.disconnect();
		});
	});

	createEffect(() => {
		rowCount();
		mediaItemHeight();
		columnCount();
		mediaRowVirtualizer.measure();
	});

	const contextMenuMediaId = () => props.contextMenuMediaId?.() ?? null;

	const onContextMenuHandler = (mediaId: string) => {
		return () => {
			props.setContextMenuMediaId?.(mediaId);
		};
	};

	const gridContent = (
		<div
			class="relative w-full"
			ref={(element) => {
				mediaGridRef = element;
				requestAnimationFrame(() => {
					updateMediaGridMetrics();
				});
			}}
			style={{
				height: shouldVirtualize()
					? `${mediaRowVirtualizer.getTotalSize()}px`
					: undefined,
			}}
		>
			<Show
				fallback={
					<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
						<For each={props.mediaResults()}>
							{(media) =>
								props.renderItem(media, {
									onContextMenu: onContextMenuHandler(media.id),
								})
							}
						</For>
					</div>
				}
				when={shouldVirtualize()}
			>
				<For each={mediaRowVirtualizer.getVirtualItems()}>
					{(virtualRow) => {
						const rowMedia = () => mediaRows()[virtualRow.index] || [];
						return (
							<div
								class="absolute left-0 top-0 grid gap-4"
								style={{
									"grid-template-columns": `repeat(${columnCount()}, minmax(0, 1fr))`,
									height: `${virtualRow.size}px`,
									transform: `translateY(${virtualRow.start}px)`,
									width: "100%",
								}}
							>
								<For each={rowMedia()}>
									{(media) =>
										props.renderItem(media, {
											onContextMenu: onContextMenuHandler(media.id),
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
		<div class="min-h-0 space-y-4">
			{/* Loading state */}
			<Show when={props.isPending && props.mediaResults().length === 0}>
				<div class="flex h-64 items-center justify-center">
					<div class="animate-pulse text-lg text-muted-foreground">
						Loading media...
					</div>
				</div>
			</Show>

			{/* Error state */}
			<Show when={props.isError}>
				<div class="text-red-500">Error: {props.queryError?.message}</div>
			</Show>

			{/* Result count */}
			<Show when={showResultCount() && props.mediaResults().length > 0}>
				<div class="mb-4 flex items-center justify-between">
					<p class="text-gray-600 text-sm">{totalCount()} 件の結果</p>
				</div>
			</Show>

			{/* Grid with optional context menu */}
			<Show
				fallback={gridContent}
				when={!disableContextMenu()}
			>
				<ContextMenu>
					<ContextMenuTrigger class="block w-full">
						{gridContent}
					</ContextMenuTrigger>
					<ContextMenuContent>
						<Show
							fallback={
								<ContextMenuItem disabled>No media selected</ContextMenuItem>
							}
							when={contextMenuMediaId()}
						>
							<Show when={showOpenInNewTab()}>
								<ContextMenuItem
									onSelect={() => {
										const id = contextMenuMediaId();
										const sourceId = props.mediaSourceId();
										if (id && sourceId) {
											window.open(`/sources/${sourceId}/${id}`, "_blank");
										}
									}}
								>
									Open in New Tab
								</ContextMenuItem>
							</Show>

							<ContextMenuItem
								class="text-red-600 focus:text-red-600"
								onSelect={() => {
									const id = contextMenuMediaId();
									if (id) props.onDelete?.(id);
								}}
							>
								Delete
							</ContextMenuItem>

							<ContextMenuSeparator />

							<ContextMenuItem
								onSelect={() => {
									const id = contextMenuMediaId();
									if (id) props.onCopyMove?.(id, "copy");
								}}
							>
								Copy to Source
							</ContextMenuItem>
							<ContextMenuItem
								onSelect={() => {
									const id = contextMenuMediaId();
									if (id) props.onCopyMove?.(id, "move");
								}}
							>
								Move to Source
							</ContextMenuItem>

							<ContextMenuSeparator />

							<ContextMenuItem
								onSelect={() => {
									const id = contextMenuMediaId();
									if (id) props.onSyncSingleMedia?.(id);
								}}
							>
								Sync Metadata (Reprocess)
							</ContextMenuItem>
						</Show>
					</ContextMenuContent>
				</ContextMenu>
			</Show>

			{/* Empty state */}
			<Show
				when={
					showEmptyState() &&
					props.mediaResults().length === 0 &&
					!props.isPending
				}
			>
				<div class="py-12 text-center text-gray-500">
					検索結果が見つかりませんでした
				</div>
			</Show>

			{/* Load more sentinel */}
			<div
				class="flex h-10 w-full items-center justify-center text-gray-500"
				ref={props.setLoadMoreRef}
			>
				<Show when={props.isFetchingNextPage}>
					<div class="text-center text-gray-500">Loading more...</div>
				</Show>
			</div>
		</div>
	);
}
