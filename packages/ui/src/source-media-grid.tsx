import type { Media } from "@solid-imager/core/domain/media/schemas";
import { createWindowVirtualizer } from "@tanstack/solid-virtual";
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
import type { QueryUiState } from "./query-state";
import { LoadingRegion, MediaGridSkeleton } from "./skeleton";

const VIRTUALIZATION_THRESHOLD = 100;
const GRID_GAP_PX = 16;
const GRID_ITEM_ASPECT_RATIO = 4 / 3;
const VIRTUAL_ROWS_OVERSCAN = 4;

type SourceMediaGridProps = {
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
	/** Render a single media grid item. */
	renderItem: (
		media: Media,
		options: {
			onContextMenu: () => void;
			isBulkSelectMode?: boolean;
			isSelected?: boolean;
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

	// Virtual scroll-based load more: trigger when user scrolls near the end
	createEffect(() => {
		if (!shouldVirtualize()) return;
		const totalRows = rowCount();
		const handleScroll = () => {
			if (!props.hasNextPage || props.isFetchingNextPage) return;
			const lastItem = mediaRowVirtualizer.getVirtualItems().at(-1);
			if (lastItem && lastItem.index >= totalRows - 2) {
				props.onLoadMore?.();
			}
		};
		window.addEventListener("scroll", handleScroll, { passive: true });
		onCleanup(() => window.removeEventListener("scroll", handleScroll));
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
									get isBulkSelectMode() {
										return props.isBulkSelectMode?.();
									},
									get isSelected() {
										return props.isSelected?.(media.id);
									},
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
											get isBulkSelectMode() {
												return props.isBulkSelectMode?.();
											},
											get isSelected() {
												return props.isSelected?.(media.id);
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
		<div class="min-h-0 space-y-4">
			<Switch>
				<Match when={props.state().phase === "pending"}>
					<LoadingRegion label="メディア一覧を読み込んでいます...">
						<MediaGridSkeleton />
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
						<div class="mb-4 flex items-center justify-between">
							<p class="text-gray-600 text-sm">{totalCount()} 件の結果</p>
						</div>
					</Show>

					{/* Grid with optional context menu */}
					<Show fallback={gridContent} when={!disableContextMenu()}>
						<ContextMenu>
							<ContextMenuTrigger class="block w-full">
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
													window.open(`/sources/${sourceId}/${id}`, "_blank");
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
						class="flex h-10 w-full items-center justify-center text-gray-500"
						ref={props.setLoadMoreRef}
					>
						<Show when={props.isFetchingNextPage}>
							<p class="text-center text-gray-500" role="status">
								読み込み中...
							</p>
						</Show>
					</div>
				</Match>
			</Switch>
		</div>
	);
}
