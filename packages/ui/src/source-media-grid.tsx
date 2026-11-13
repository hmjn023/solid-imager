import { mediaTypeLabel } from "./display-labels";
import { getLocale, t } from "@solid-imager/i18n";
import type { SimilarityModel } from "@solid-imager/core/search";
import type { Media } from "@solid-imager/core/media";
import { useMenuContext } from "@kobalte/core/menu";
import Copy from "lucide-solid/icons/copy";
import ExternalLink from "lucide-solid/icons/external-link";
import FolderInput from "lucide-solid/icons/folder-input";
import ListChecks from "lucide-solid/icons/list-checks";
import SquareCheck from "lucide-solid/icons/square-check";
import X from "lucide-solid/icons/x";
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
import { Button } from "./button";
import { EmptyState, ErrorState, OfflineState } from "./async-state";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuGroupLabel,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuTrigger,
} from "./context-menu";
import type { MediaCollectionSelectionMode } from "./hooks/use-media-collection-selection";
import type { MediaGridImageLoadPolicy } from "./media-grid-item";
import { MediaTileGrid } from "./media-tile-grid";
import { createMediaPreviewSelectHandler } from "./media-preview-selection";
import type { QueryUiState } from "./query-state";
import { LoadingRegion, MediaGridSkeleton } from "./skeleton";
import {
	findCollectionItemById,
	isCollectionScrollNearEnd,
} from "./workspace/collection-navigation";
import { FileText, RefreshCw, ScanSearch, Trash2 } from "./workspace/icons";

export type SourceMediaViewMode = "grid" | "list";
const LIST_LOAD_MORE_THRESHOLD_PX = 480;

type SourceMediaGridProps = {
	detailBasePath?: string;
	itemAspectRatio?: number;
	scrollMode?: "element" | "window";
	mediaResults: Accessor<Media[]>;
	mediaSourceId: Accessor<string | undefined>;
	state: Accessor<QueryUiState<Media[]>>;
	isFetchingNextPage: boolean;
	isFetchNextPageError?: boolean;
	onRetry?: () => void | Promise<void>;
	contextMenuMediaId?: Accessor<string | null>;
	setContextMenuMediaId?: Setter<string | null>;
	onDelete?: (mediaId: string) => void;
	onCopyMove?: (mediaId: string, mode: "copy" | "move") => void;
	onSyncSingleMedia?: (mediaId: string) => void;
	onFindSimilar?: (media: Media, model?: SimilarityModel) => void;
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
		return error instanceof Error
			? error.message
			: t("sourceMediaGrid.couldNotConnectToTheAPI");
	};
	const canFindSimilar = (media: Media) =>
		props.onFindSimilar !== undefined &&
		(media.mediaType === "image" || media.mediaType === "video");

	const [collectionRoot, setCollectionRoot] = createSignal<HTMLDivElement>();
	const [internalContextMenuMedia, setInternalContextMenuMedia] =
		createSignal<Media>();
	const [scrollElement, setScrollElement] = createSignal<HTMLElement>();
	const [loadMoreTarget, setLoadMoreTarget] = createSignal<HTMLDivElement>();
	let listLoadRequestPending = false;
	let listLoadRequestCount = -1;
	let listLoadWasFetching = false;

	onMount(() => {
		setScrollElement(
			collectionRoot()?.closest<HTMLElement>("[data-media-scroll]") ??
				undefined,
		);
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
				props.isFetchNextPageError ||
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
	const handleMediaDragStart = (event: DragEvent) => {
		if (findMediaFromEventTarget(event.target)) {
			event.preventDefault();
		}
	};

	onMount(() => {
		const element = collectionRoot();
		element?.addEventListener("dragstart", handleMediaDragStart);
		onCleanup(() => {
			element?.removeEventListener("dragstart", handleMediaDragStart);
		});
	});

	const gridLoadMore = createMemo(() =>
		props.hasNextPage &&
		!props.isFetchingNextPage &&
		!props.isFetchNextPageError &&
		props.state().fetchState === "idle" &&
		viewMode() === "grid"
			? props.onLoadMore
			: undefined,
	);
	const gridContent = (
		<MediaTileGrid
			items={props.mediaResults()}
			ariaLabel={t("sourceMediaScreen.mediaList")}
			itemAspectRatio={props.itemAspectRatio}
			enableVirtualization={props.enableVirtualization}
			scrollMode={props.scrollMode}
			onNavigate={props.onPreviewSelect}
			onDelete={props.onDelete}
			loadMoreTarget={loadMoreTarget}
			onNearEnd={gridLoadMore()}
			renderItem={(media, imageLoadPolicy, priority) =>
				props.renderItem(media, {
					imageLoadPolicy,
					priority,
					onContextMenu: onContextMenuHandler(media),
					onOpenMediaDetail: props.onOpenMediaDetail
						? () => props.onOpenMediaDetail?.(media)
						: undefined,
					onPrepareMediaDetail: () => props.onPrepareMediaDetail?.(media),
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
		/>
	);
	const formatFileSize = (bytes: number | null): string => {
		if (bytes === null) return "—";
		if (bytes < 1024)
			return t("uploadMediaModal.valueB", { value0: String(bytes) });
		if (bytes < 1024 * 1024)
			return t("uploadMediaModal.valueKB", {
				value0: String((bytes / 1024).toFixed(1)),
			});
		return t("uploadMediaModal.valueMB", {
			value0: String((bytes / (1024 * 1024)).toFixed(1)),
		});
	};
	const listContent = (
		<div class="overflow-x-auto rounded-md border border-border bg-card scrollbar-stable">
			<table class="w-full min-w-table-extra-wide border-collapse text-left text-sm">
				<caption class="sr-only">
					{t("sourceMediaGrid.mediaListValueItems", {
						value0: String(totalCount().toLocaleString()),
					})}
				</caption>
				<thead class="bg-muted text-xs text-muted-foreground">
					<tr>
						<Show when={props.isBulkSelectMode?.()}>
							<th class="w-10 px-3 py-2" scope="col">
								<span class="sr-only">{t("jobsScreen.select")}</span>
							</th>
						</Show>
						<th class="px-3 py-2 font-medium" scope="col">
							{t("labels.name")}
						</th>
						<th class="px-3 py-2 font-medium" scope="col">
							{t("jobsScreen.type")}
						</th>
						<th class="px-3 py-2 font-medium" scope="col">
							{t("sourceMediaGrid.dimensions")}
						</th>
						<th class="px-3 py-2 font-medium" scope="col">
							{t("collectionInspector.size")}
						</th>
						<th class="px-3 py-2 font-medium" scope="col">
							{t("sourceMediaGrid.modified")}
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					<For each={props.mediaResults()}>
						{(media) => (
							<tr
								aria-label={t("sourceMediaGrid.valueValue", {
									value0: String(media.fileName),
									value1: String(media.filePath),
								})}
								aria-selected={props.previewSelectedMediaId?.() === media.id}
								class={`outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
									props.isSelected?.(media.id) ||
									props.previewSelectedMediaId?.() === media.id
										? "bg-accent"
										: "hover:bg-muted"
								}`}
								data-media-id={media.id}
								onClick={(event) => {
									if (
										event.target instanceof Element &&
										event.target.closest("[data-collection-row-control]")
									) {
										return;
									}
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
									prepareAndOpenMediaDetail(media);
								}}
								onKeyDown={(event) => {
									if (event.target !== event.currentTarget) return;
									if (event.key === "Enter" && props.onOpenMediaDetail) {
										event.preventDefault();
										prepareAndOpenMediaDetail(media);
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
											aria-label={t("sourceMediaGrid.selectValue", {
												value0: String(media.fileName),
											})}
											checked={props.isSelected?.(media.id) ?? false}
											data-collection-row-control
											onChange={() => props.onToggleSelect?.(media.id)}
											onClick={(event) => event.stopPropagation()}
											type="checkbox"
										/>
									</td>
								</Show>
								<th
									aria-label={t("sourceMediaGrid.valueValue", {
										value0: String(media.fileName),
										value1: String(media.filePath),
									})}
									class="max-w-dialog-reading px-3 py-2 font-normal"
									scope="row"
								>
									<div class="min-h-10 w-full px-1 py-1 text-left">
										<span
											class="block truncate font-medium text-foreground"
											title={media.fileName}
										>
											{media.fileName}
										</span>
										<span
											class="mt-0.5 block truncate text-muted-foreground text-xs"
											title={media.filePath}
										>
											{media.filePath}
										</span>
									</div>
								</th>
								<td class="px-3 py-2 text-muted-foreground">
									{mediaTypeLabel(media.mediaType)}
								</td>
								<td class="whitespace-nowrap px-3 py-2 text-muted-foreground">
									{media.width} × {media.height}
								</td>
								<td class="whitespace-nowrap px-3 py-2 text-muted-foreground">
									{formatFileSize(media.fileSize)}
								</td>
								<td class="whitespace-nowrap px-3 py-2 text-muted-foreground">
									{media.modifiedAt.toLocaleDateString(getLocale())}
								</td>
							</tr>
						)}
					</For>
				</tbody>
			</table>
		</div>
	);
	const hasContextMenuActions = (media: Media) =>
		Boolean(
			props.onOpenMediaDetail ||
			canFindSimilar(media) ||
			props.onToggleSelect ||
			props.onBulkAction ||
			props.onClearSelection ||
			props.onDelete ||
			props.onCopyMove ||
			props.onSyncSingleMedia,
		);
	const prepareAndOpenMediaDetail = (media: Media) => {
		props.onPrepareMediaDetail?.(media);
		props.onOpenMediaDetail?.(media);
	};
	const handleContextMenuKeyDown = (
		event: KeyboardEvent,
		close: () => void,
	) => {
		if (
			event.defaultPrevented ||
			event.isComposing ||
			event.metaKey ||
			event.ctrlKey ||
			event.altKey ||
			event.shiftKey
		)
			return;
		const media = contextMenuMedia();
		if (!media) return;
		// Enter/Space on a focused menu item retain the menu's native activation.
		const onMenuItem =
			event.target instanceof Element &&
			event.target.closest('[role="menuitem"]');
		const action =
			event.key === "Delete" && props.onDelete
				? () => props.onDelete?.(media.id)
				: !onMenuItem && event.key === " " && props.onToggleSelect
					? () => props.onToggleSelect?.(media.id)
					: !onMenuItem && event.key === "Enter" && props.onOpenMediaDetail
						? () => prepareAndOpenMediaDetail(media)
						: undefined;
		if (!action) return;
		event.preventDefault();
		event.stopPropagation();
		if (event.repeat) return;
		close();
		queueMicrotask(action);
	};
	const openMediaInNewTab = (media: Media) => {
		props.onPrepareMediaDetail?.(media);
		const detailBasePath = (props.detailBasePath ?? "/sources").replace(
			/\/$/,
			"",
		);
		window.open(
			`${detailBasePath}/${media.mediaSourceId}/${media.id}`,
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
		<div class="min-h-0 min-w-0 space-y-4" ref={setCollectionRoot}>
			<Switch>
				<Match when={props.state().phase === "pending"}>
					<LoadingRegion label={t("sourceMediaScreen.loadingMediaList")}>
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
						title={
							props.errorTitle ?? t("sourceMediaGrid.couldNotLoadTheMediaList")
						}
					/>
				</Match>
				<Match when={props.state().phase === "offline"}>
					<OfflineState
						description={t("sourceMediaGrid.checkYourConnectionAndRetry")}
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
							<p class="text-muted-foreground text-sm">
								{t("sourceMediaGrid.valueResults", {
									value0: String(totalCount()),
								})}
							</p>
						</div>
					</Show>

					{/* Grid and list share the same target-safe context menu. */}
					<Show
						fallback={collectionContent}
						when={!disableContextMenu() && Boolean(collectionRoot())}
					>
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
									aria-label={t("sourceMediaGrid.mediaListActionTarget")}
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
							<MediaContextMenuContent onShortcut={handleContextMenuKeyDown}>
								<Show
									keyed
									fallback={
										<ContextMenuItem disabled>
											{t("actions.selectMedia")}
										</ContextMenuItem>
									}
									when={contextMenuMedia()}
								>
									{(media) => (
										<>
											<ContextMenuGroup>
												<ContextMenuGroupLabel
													class="max-w-72 truncate text-muted-foreground"
													title={media.fileName}
												>
													{media.fileName}
												</ContextMenuGroupLabel>
												<ContextMenuSeparator />
												<Show when={!hasContextMenuActions(media)}>
													<ContextMenuItem disabled>
														{t("sourceMediaGrid.noActionsAvailable")}
													</ContextMenuItem>
												</Show>
												<Show when={props.onOpenMediaDetail}>
													<ContextMenuItem
														onSelect={() => prepareAndOpenMediaDetail(media)}
													>
														<FileText
															aria-hidden="true"
															class="mr-2 shrink-0"
															size={14}
														/>
														{t("collectionInspector.openDetails")}
														<ContextMenuShortcut>
															{t("sourceMediaGrid.enter")}
														</ContextMenuShortcut>
													</ContextMenuItem>
												</Show>
												<Show
													when={showOpenInNewTab() && props.onOpenMediaDetail}
												>
													<ContextMenuItem
														onSelect={() => openMediaInNewTab(media)}
													>
														<ExternalLink
															aria-hidden="true"
															class="mr-2 shrink-0"
															size={14}
														/>
														{t("sourceMediaGrid.openInANewTab")}
													</ContextMenuItem>
												</Show>
												<Show when={canFindSimilar(media)}>
													<ContextMenuItem
														onSelect={() =>
															props.onFindSimilar?.(media, "ccip")
														}
													>
														<ScanSearch
															aria-hidden="true"
															class="mr-2 shrink-0"
															size={14}
														/>
														{t("sourceMediaGrid.similaritySearch")}
													</ContextMenuItem>
													<ContextMenuItem
														onSelect={() =>
															props.onFindSimilar?.(media, "embeddinggemma2")
														}
													>
														<ScanSearch
															aria-hidden="true"
															class="mr-2 shrink-0"
															size={14}
														/>
														{t(
															"sourceMediaGrid.similaritySearchEmbeddingGemma2",
														)}
													</ContextMenuItem>
												</Show>
												<Show when={props.onToggleSelect}>
													<ContextMenuItem
														onSelect={() => props.onToggleSelect?.(media.id)}
													>
														<SquareCheck
															aria-hidden="true"
															class="mr-2 shrink-0"
															size={14}
														/>
														{props.isBulkSelectMode?.() &&
														props.isSelected?.(media.id)
															? t("actions.clearSelection")
															: t("jobsScreen.select")}
														<ContextMenuShortcut>
															{t("sourceMediaGrid.space")}
														</ContextMenuShortcut>
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
															<ListChecks
																aria-hidden="true"
																class="mr-2 shrink-0"
																size={14}
															/>
															{t("sourceMediaGrid.runBulkAction")}
															{props.selectedCount?.()}
															{t("sourceMediaGrid.selected")}
														</ContextMenuItem>
													</Show>
													<Show when={props.onClearSelection}>
														<ContextMenuItem
															onSelect={() => props.onClearSelection?.()}
														>
															<X
																aria-hidden="true"
																class="mr-2 shrink-0"
																size={14}
															/>
															{t("actions.clearSelection")}
														</ContextMenuItem>
													</Show>
												</Show>
												<Show when={props.onDelete}>
													<ContextMenuSeparator />
													<ContextMenuItem
														class="text-destructive focus:text-destructive"
														onSelect={() => props.onDelete?.(media.id)}
													>
														<Trash2
															aria-hidden="true"
															class="mr-2 shrink-0"
															size={14}
														/>
														{t("actions.delete")}
														<ContextMenuShortcut>
															{t("keys.delete")}
														</ContextMenuShortcut>
													</ContextMenuItem>
												</Show>
												<Show when={props.onCopyMove}>
													<ContextMenuSeparator />
													<ContextMenuItem
														onSelect={() =>
															props.onCopyMove?.(media.id, "copy")
														}
													>
														<Copy
															aria-hidden="true"
															class="mr-2 shrink-0"
															size={14}
														/>
														{t("sourceMediaGrid.copyToAnotherSource")}
													</ContextMenuItem>
													<ContextMenuItem
														onSelect={() =>
															props.onCopyMove?.(media.id, "move")
														}
													>
														<FolderInput
															aria-hidden="true"
															class="mr-2 shrink-0"
															size={14}
														/>
														{t("sourceMediaGrid.moveToAnotherSource")}
													</ContextMenuItem>
												</Show>
												<Show when={props.onSyncSingleMedia}>
													<ContextMenuSeparator />
													<ContextMenuItem
														onSelect={() => props.onSyncSingleMedia?.(media.id)}
													>
														<RefreshCw
															aria-hidden="true"
															class="mr-2 shrink-0"
															size={14}
														/>
														{t("sourceMediaGrid.syncMetadataReprocess")}
													</ContextMenuItem>
												</Show>
											</ContextMenuGroup>
										</>
									)}
								</Show>
							</MediaContextMenuContent>
						</ContextMenu>
					</Show>

					{/* Empty state */}
					<Show when={showEmptyState() && props.state().phase === "empty"}>
						<EmptyState
							description={t(
								"sourceMediaGrid.changeYourSearchConditionsAndTryAgain",
							)}
							title={t("sourceMediaGrid.noSearchResultsFound")}
						/>
					</Show>

					{/* Load more sentinel */}
					<div
						aria-atomic="true"
						aria-live="polite"
						class="flex min-h-11 w-full items-center justify-center py-2 text-muted-foreground text-sm"
						data-testid="media-load-more-sentinel"
						ref={(el) => {
							setLoadMoreTarget(el);
							props.setLoadMoreRef(el);
						}}
					>
						<Show
							fallback={
								<Show when={props.hasNextPage}>
									<Show
										when={props.isFetchNextPageError}
										fallback={<p>{t("sourceMediaGrid.scrollToLoadMore")}</p>}
									>
										<Button
											variant="outline"
											size="sm"
											onClick={props.onLoadMore}
										>
											{t("sourceMediaGrid.retryLoadingMore")}
										</Button>
									</Show>
								</Show>
							}
							when={props.isFetchingNextPage}
						>
							<p>{t("status.loading")}</p>
						</Show>
					</div>
				</Match>
			</Switch>
		</div>
	);
}

function MediaContextMenuContent(props: {
	children: JSX.Element;
	onShortcut: (event: KeyboardEvent, close: () => void) => void;
}) {
	const menu = useMenuContext();
	return (
		<ContextMenuContent
			class="workspace-theme min-w-56 max-w-80"
			onKeyDown={(event) => props.onShortcut(event, () => menu.close(true))}
		>
			{props.children}
		</ContextMenuContent>
	);
}
