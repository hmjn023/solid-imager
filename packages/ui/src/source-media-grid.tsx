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
	createSelector,
	createSignal,
	For,
	Match,
	onCleanup,
	onMount,
	Show,
	Switch,
} from "solid-js";
import { Button } from "./button";
import { Checkbox, CheckboxControl, CheckboxLabel } from "./checkbox";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuGroupLabel,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./dropdown-menu";
import type { MediaCollectionSelectionMode } from "./hooks/use-media-collection-selection";
import { useOpenOriginalMedia } from "./media-content-access";
import type { MediaGridImageLoadPolicy } from "./media-grid-item";
import { useCopyMediaImage } from "./media-image-clipboard";
import { MediaTileGrid } from "./media-tile-grid";
import {
	createMediaPreviewSelectHandler,
	isFineMediaPointer,
	isModifiedSelectionClick,
	isPlainPrimaryClick,
} from "./media-preview-selection";
import type { QueryUiState } from "./query-state";
import { ListSkeleton, LoadingRegion, MediaGridSkeleton } from "./skeleton";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "./table";
import {
	findCollectionItemById,
	getCollectionNavigationIndex,
	isCollectionNavigationKey,
	isCollectionScrollNearEnd,
} from "./workspace/collection-navigation";
import {
	Ellipsis,
	FileText,
	RefreshCw,
	ScanSearch,
	Trash2,
} from "./workspace/icons";

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
	emptyState?: JSX.Element;
	onClearSearch?: () => void;
	/** Show the actions that open details or the original in a new tab. Default: true. */
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
	const copyMediaImage = useCopyMediaImage();
	const openOriginalMedia = useOpenOriginalMedia();
	const showResultCount = () => props.showResultCount ?? true;
	const showEmptyState = () => props.showEmptyState ?? true;
	const showOpenInNewTab = () => props.showOpenInNewTab ?? true;
	const disableContextMenu = () => props.disableContextMenu ?? false;
	const isPreviewSelected = createSelector(() =>
		props.previewSelectedMediaId?.(),
	);
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
		const mode = selectionModeFromEvent(event);
		const previewId = props.previewSelectedMediaId?.();
		if (
			(mode === "range" || mode === "additive-range") &&
			!props.isBulkSelectMode?.() &&
			previewId &&
			previewId !== media.id
		) {
			props.onSelectMedia?.(previewId, "replace");
		}
		props.onSelectMedia?.(media.id, mode);
		props.onPreviewSelect?.(media);
	};
	const toggleRowSelection = (media: Media) => {
		if (props.onToggleSelect) props.onToggleSelect(media.id);
		else props.onSelectMedia?.(media.id, "toggle");
	};
	// Solid also delegates events from the row's portaled menu to the row.
	const isRowClickTarget = (
		row: HTMLTableRowElement,
		target: EventTarget | null,
	) =>
		target instanceof Element &&
		row.contains(target) &&
		!target.closest("[data-collection-row-control]");
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
	let tableBodyRef: HTMLTableSectionElement | undefined;
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
		void props.mediaResults().length;
		void props.hasNextPage;
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
	const hasContextMenuActions = (media: Media) =>
		Boolean(
			props.onOpenMediaDetail ||
			showOpenInNewTab() ||
			media.mediaType === "image" ||
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
	const renderMenuActionItems = (
		media: Media,
		kind: "context" | "dropdown",
	) => {
		const Item = (itemProps: {
			children: JSX.Element;
			destructive?: boolean;
			onSelect: () => void;
		}) =>
			kind === "context" ? (
				itemProps.destructive ? (
					<ContextMenuItem
						class="text-destructive focus:text-destructive"
						onSelect={itemProps.onSelect}
					>
						{itemProps.children}
					</ContextMenuItem>
				) : (
					<ContextMenuItem onSelect={itemProps.onSelect}>
						{itemProps.children}
					</ContextMenuItem>
				)
			) : itemProps.destructive ? (
				<DropdownMenuItem
					class="text-destructive focus:text-destructive"
					onSelect={itemProps.onSelect}
				>
					{itemProps.children}
				</DropdownMenuItem>
			) : (
				<DropdownMenuItem onSelect={itemProps.onSelect}>
					{itemProps.children}
				</DropdownMenuItem>
			);
		const Separator = () =>
			kind === "context" ? <ContextMenuSeparator /> : <DropdownMenuSeparator />;
		const Group = (groupProps: { children: JSX.Element }) =>
			kind === "context" ? (
				<ContextMenuGroup>{groupProps.children}</ContextMenuGroup>
			) : (
				<DropdownMenuGroup>{groupProps.children}</DropdownMenuGroup>
			);
		const GroupLabel = (labelProps: {
			children: JSX.Element;
			title?: string;
		}) =>
			kind === "context" ? (
				<ContextMenuGroupLabel
					class="max-w-72 truncate text-muted-foreground"
					title={labelProps.title}
				>
					{labelProps.children}
				</ContextMenuGroupLabel>
			) : (
				<DropdownMenuGroupLabel
					class="max-w-72 truncate text-muted-foreground"
					title={labelProps.title}
				>
					{labelProps.children}
				</DropdownMenuGroupLabel>
			);

		return (
			<Group>
				<GroupLabel title={media.fileName}>{media.fileName}</GroupLabel>
				<Separator />
				<Show when={!hasContextMenuActions(media)}>
					<Show
						fallback={
							<DropdownMenuItem disabled>
								{t("sourceMediaGrid.noActionsAvailable")}
							</DropdownMenuItem>
						}
						when={kind === "context"}
					>
						<ContextMenuItem disabled>
							{t("sourceMediaGrid.noActionsAvailable")}
						</ContextMenuItem>
					</Show>
				</Show>
				<Show when={props.onOpenMediaDetail}>
					<Item onSelect={() => prepareAndOpenMediaDetail(media)}>
						<FileText aria-hidden="true" class="mr-2 shrink-0" size={14} />
						{t("collectionInspector.openDetails")}
						<Show when={kind === "context"}>
							<ContextMenuShortcut>
								{t("sourceMediaGrid.enter")}
							</ContextMenuShortcut>
						</Show>
					</Item>
				</Show>
				<Show when={showOpenInNewTab() && props.onOpenMediaDetail}>
					<Item onSelect={() => openMediaInNewTab(media)}>
						<ExternalLink aria-hidden="true" class="mr-2 shrink-0" size={14} />
						{t("sourceMediaGrid.openInANewTab")}
					</Item>
				</Show>
				<Show when={showOpenInNewTab()}>
					<Item onSelect={() => openOriginalMedia(media)}>
						<ExternalLink aria-hidden="true" class="mr-2 shrink-0" size={14} />
						{t("actions.openOriginalInNewTab")}
					</Item>
				</Show>
				<Show when={media.mediaType === "image"}>
					<Item onSelect={() => void copyMediaImage(media)}>
						<Copy aria-hidden="true" class="mr-2 shrink-0" size={14} />
						{t("actions.copyImage")}
					</Item>
				</Show>
				<Show when={canFindSimilar(media)}>
					<Item onSelect={() => props.onFindSimilar?.(media, "ccip")}>
						<ScanSearch aria-hidden="true" class="mr-2 shrink-0" size={14} />
						{t("sourceMediaGrid.similaritySearch")}
					</Item>
					<Item
						onSelect={() => props.onFindSimilar?.(media, "embeddinggemma2")}
					>
						<ScanSearch aria-hidden="true" class="mr-2 shrink-0" size={14} />
						{t("sourceMediaGrid.similaritySearchEmbeddingGemma2")}
					</Item>
				</Show>
				<Show when={props.onToggleSelect}>
					<Item onSelect={() => props.onToggleSelect?.(media.id)}>
						<SquareCheck aria-hidden="true" class="mr-2 shrink-0" size={14} />
						{props.isBulkSelectMode?.() && props.isSelected?.(media.id)
							? t("actions.clearSelection")
							: t("jobsScreen.select")}
						<Show when={kind === "context"}>
							<ContextMenuShortcut>
								{t("sourceMediaGrid.space")}
							</ContextMenuShortcut>
						</Show>
					</Item>
				</Show>
				<Show
					when={
						props.isBulkSelectMode?.() &&
						(props.selectedCount?.() ?? 0) > 0 &&
						(props.onBulkAction || props.onClearSelection)
					}
				>
					<Show when={props.onBulkAction}>
						<Item onSelect={() => props.onBulkAction?.()}>
							<ListChecks aria-hidden="true" class="mr-2 shrink-0" size={14} />
							{t("sourceMediaGrid.runBulkAction")}
							{props.selectedCount?.()}
							{t("sourceMediaGrid.selected")}
						</Item>
					</Show>
					<Show when={props.onClearSelection}>
						<Item onSelect={() => props.onClearSelection?.()}>
							<X aria-hidden="true" class="mr-2 shrink-0" size={14} />
							{t("actions.clearSelection")}
						</Item>
					</Show>
				</Show>
				<Show when={props.onDelete}>
					<Separator />
					<Item destructive onSelect={() => props.onDelete?.(media.id)}>
						<Trash2 aria-hidden="true" class="mr-2 shrink-0" size={14} />
						{t("actions.delete")}
						<Show when={kind === "context"}>
							<ContextMenuShortcut>{t("keys.delete")}</ContextMenuShortcut>
						</Show>
					</Item>
				</Show>
				<Show when={props.onCopyMove}>
					<Separator />
					<Item onSelect={() => props.onCopyMove?.(media.id, "copy")}>
						<Copy aria-hidden="true" class="mr-2 shrink-0" size={14} />
						{t("sourceMediaGrid.copyToAnotherSource")}
					</Item>
					<Item onSelect={() => props.onCopyMove?.(media.id, "move")}>
						<FolderInput aria-hidden="true" class="mr-2 shrink-0" size={14} />
						{t("sourceMediaGrid.moveToAnotherSource")}
					</Item>
				</Show>
				<Show when={props.onSyncSingleMedia}>
					<Separator />
					<Item onSelect={() => props.onSyncSingleMedia?.(media.id)}>
						<RefreshCw aria-hidden="true" class="mr-2 shrink-0" size={14} />
						{t("sourceMediaGrid.syncMetadataReprocess")}
					</Item>
				</Show>
			</Group>
		);
	};

	const GridContent = () => (
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
			renderItem={(media, imageLoadPolicy, priority) => {
				const tile = props.renderItem(media, {
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
					get onPreviewSelect() {
						return createMediaPreviewSelectHandler(
							media,
							props.onPreviewSelect,
						);
					},
					onSelectGesture: props.onSelectMedia
						? (event) => selectFromGesture(media, event)
						: undefined,
					get isPreviewSelected() {
						return isPreviewSelected(media.id);
					},
				});

				return (
					<div class="group/tile relative min-w-0">
						{tile}
						<Show when={!disableContextMenu() && hasContextMenuActions(media)}>
							<DropdownMenu placement="bottom-start">
								<DropdownMenuTrigger
									aria-label={t("sourceList.actionsForValue", {
										value0: String(media.fileName),
									})}
									class="absolute top-1.5 left-1.5 z-20 flex size-10 items-center justify-center rounded-md border border-border bg-background/90 text-foreground opacity-90 shadow-sm outline-none transition-opacity hover:bg-muted focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring sm:size-7 sm:opacity-0 sm:group-focus-within/tile:opacity-100 sm:group-hover/tile:opacity-100"
									onClick={(event: MouseEvent) => event.stopPropagation()}
									onPointerDown={(event: PointerEvent) =>
										event.stopPropagation()
									}
									type="button"
								>
									<Ellipsis aria-hidden="true" size={14} />
								</DropdownMenuTrigger>
								<DropdownMenuContent class="workspace-theme min-w-56 max-w-80">
									{renderMenuActionItems(media, "dropdown")}
								</DropdownMenuContent>
							</DropdownMenu>
						</Show>
					</div>
				);
			}}
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
	const ListContent = () => (
		<div class="overflow-hidden rounded-md border border-border bg-card">
			<Table class="min-w-table-extra-wide border-collapse text-left text-sm">
				<TableCaption class="sr-only mt-0">
					{t("sourceMediaGrid.mediaListValueItems", {
						value0: String(totalCount().toLocaleString()),
					})}
				</TableCaption>
				<TableHeader class="bg-muted text-xs text-muted-foreground">
					<TableRow class="hover:bg-transparent">
						<Show when={props.isBulkSelectMode?.()}>
							<TableHead class="h-auto w-10 px-3 py-2" scope="col">
								<span class="sr-only">{t("jobsScreen.select")}</span>
							</TableHead>
						</Show>
						<TableHead class="h-auto px-3 py-2 font-medium" scope="col">
							{t("labels.name")}
						</TableHead>
						<TableHead class="h-auto px-3 py-2 font-medium" scope="col">
							{t("jobsScreen.type")}
						</TableHead>
						<TableHead class="h-auto px-3 py-2 font-medium" scope="col">
							{t("sourceMediaGrid.dimensions")}
						</TableHead>
						<TableHead class="h-auto px-3 py-2 font-medium" scope="col">
							{t("collectionInspector.size")}
						</TableHead>
						<TableHead class="h-auto px-3 py-2 font-medium" scope="col">
							{t("sourceMediaGrid.modified")}
						</TableHead>
						<Show when={!disableContextMenu()}>
							<TableHead class="h-auto w-12 px-2 py-2 text-right" scope="col">
								<span class="sr-only">{t("entityPanel.actions")}</span>
							</TableHead>
						</Show>
					</TableRow>
				</TableHeader>
				<TableBody
					class="divide-y divide-border"
					ref={(element: HTMLTableSectionElement) => {
						tableBodyRef = element;
					}}
				>
					<For each={props.mediaResults()}>
						{(media, index) => (
							<TableRow
								aria-label={t("sourceMediaGrid.valueValue", {
									value0: String(media.fileName),
									value1: String(media.filePath),
								})}
								aria-selected={
									props.isBulkSelectMode?.()
										? props.isSelected?.(media.id)
										: isPreviewSelected(media.id)
								}
								class={
									(
										props.isBulkSelectMode?.()
											? props.isSelected?.(media.id)
											: isPreviewSelected(media.id)
									)
										? "bg-accent outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring hover:bg-accent"
										: "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring hover:bg-muted"
								}
								data-media-id={media.id}
								onClick={(event) => {
									if (!isRowClickTarget(event.currentTarget, event.target))
										return;
									const bulk = props.isBulkSelectMode?.();
									if (
										props.onSelectMedia &&
										isModifiedSelectionClick(event) &&
										(bulk || isFineMediaPointer(event))
									) {
										event.preventDefault();
										selectFromGesture(media, event);
									} else if (!isPlainPrimaryClick(event)) {
										return;
									} else if (bulk) {
										toggleRowSelection(media);
									} else if (
										props.onPreviewSelect &&
										isFineMediaPointer(event)
									) {
										props.onPreviewSelect?.(media);
									} else if (props.onOpenMediaDetail) {
										prepareAndOpenMediaDetail(media);
										return;
									}
									event.currentTarget.focus({ preventScroll: true });
								}}
								onContextMenu={onContextMenuHandler(media)}
								onDblClick={(event) => {
									if (
										!isRowClickTarget(event.currentTarget, event.target) ||
										props.isBulkSelectMode?.() ||
										!props.onPreviewSelect ||
										!isPlainPrimaryClick(event) ||
										!isFineMediaPointer(event)
									) {
										return;
									}
									prepareAndOpenMediaDetail(media);
								}}
								onKeyDown={(event) => {
									if (
										event.target !== event.currentTarget ||
										event.altKey ||
										event.ctrlKey ||
										event.metaKey
									) {
										return;
									}
									if (
										event.key === "Delete" &&
										!event.shiftKey &&
										props.onDelete
									) {
										event.preventDefault();
										if (!event.repeat) props.onDelete(media.id);
										return;
									}
									if (
										isCollectionNavigationKey(event.key) &&
										event.key !== "ArrowLeft" &&
										event.key !== "ArrowRight" &&
										!event.shiftKey
									) {
										const nextIndex = getCollectionNavigationIndex({
											columnCount: 1,
											currentIndex: index(),
											itemCount: props.mediaResults().length,
											key: event.key,
											pageRowCount: 10,
										});
										if (nextIndex !== null) {
											const nextMedia = props.mediaResults()[nextIndex];
											if (nextMedia) {
												event.preventDefault();
												props.onPreviewSelect?.(nextMedia);
												tableBodyRef
													?.querySelector<HTMLElement>(
														`tr[data-media-id="${CSS.escape(nextMedia.id)}"]`,
													)
													?.focus({ preventScroll: true });
											}
										}
										return;
									}
									if (event.shiftKey) return;
									if (
										event.key === "Enter" &&
										(props.isBulkSelectMode?.() || props.onOpenMediaDetail)
									) {
										event.preventDefault();
										if (event.repeat) return;
										if (props.isBulkSelectMode?.()) toggleRowSelection(media);
										else prepareAndOpenMediaDetail(media);
									}
									if (event.key === " ") event.preventDefault();
								}}
								onKeyUp={(event) => {
									if (
										event.target !== event.currentTarget ||
										event.key !== " " ||
										event.altKey ||
										event.repeat
									) {
										return;
									}
									event.preventDefault();
									if (
										props.onSelectMedia &&
										(event.shiftKey || event.ctrlKey || event.metaKey)
									) {
										selectFromGesture(media, event);
									} else if (props.onToggleSelect || props.onSelectMedia) {
										toggleRowSelection(media);
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
									<TableCell class="px-3 py-2">
										<Checkbox
											checked={props.isSelected?.(media.id) ?? false}
											class="flex min-h-11 items-center justify-center sm:min-h-10"
											data-collection-row-control=""
											onChange={() => toggleRowSelection(media)}
											onClick={(event: MouseEvent) => event.stopPropagation()}
										>
											<CheckboxControl />
											<CheckboxLabel class="sr-only">
												{t("sourceMediaGrid.selectValue", {
													value0: String(media.fileName),
												})}
											</CheckboxLabel>
										</Checkbox>
									</TableCell>
								</Show>
								<TableHead
									aria-label={t("sourceMediaGrid.valueValue", {
										value0: String(media.fileName),
										value1: String(media.filePath),
									})}
									class="h-auto max-w-dialog-reading px-3 py-2 font-normal text-foreground"
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
								</TableHead>
								<TableCell class="px-3 py-2 text-muted-foreground">
									{mediaTypeLabel(media.mediaType)}
								</TableCell>
								<TableCell class="whitespace-nowrap px-3 py-2 text-muted-foreground">
									{media.width} × {media.height}
								</TableCell>
								<TableCell class="whitespace-nowrap px-3 py-2 text-muted-foreground">
									{formatFileSize(media.fileSize)}
								</TableCell>
								<TableCell class="whitespace-nowrap px-3 py-2 text-muted-foreground">
									{media.modifiedAt.toLocaleDateString(getLocale())}
								</TableCell>
								<Show when={!disableContextMenu()}>
									<TableCell class="px-2 py-2 text-right">
										<Show when={hasContextMenuActions(media)}>
											<DropdownMenu placement="bottom-end">
												<DropdownMenuTrigger
													aria-label={t("sourceList.actionsForValue", {
														value0: String(media.fileName),
													})}
													class="flex size-11 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:size-8"
													data-collection-row-control=""
													onClick={(event: MouseEvent) =>
														event.stopPropagation()
													}
													type="button"
												>
													<Ellipsis aria-hidden="true" size={14} />
												</DropdownMenuTrigger>
												<DropdownMenuContent class="workspace-theme min-w-56 max-w-80">
													{renderMenuActionItems(media, "dropdown")}
												</DropdownMenuContent>
											</DropdownMenu>
										</Show>
									</TableCell>
								</Show>
							</TableRow>
						)}
					</For>
				</TableBody>
			</Table>
		</div>
	);

	const CollectionContent = () => (
		<Show fallback={<GridContent />} when={viewMode() === "list"}>
			<ListContent />
		</Show>
	);

	return (
		<div class="min-h-0 min-w-0 space-y-4" ref={setCollectionRoot}>
			<Switch>
				<Match when={props.state().phase === "pending"}>
					<LoadingRegion label={t("sourceMediaScreen.loadingMediaList")}>
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
								/>
							}
							when={viewMode() === "list"}
						>
							<ListSkeleton />
						</Show>
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
					<Show fallback={<CollectionContent />} when={!disableContextMenu()}>
						<ContextMenu
							onOpenChange={(open) => {
								if (!open) clearContextMenuTarget();
							}}
						>
							<ContextMenuTrigger
								aria-label={t("sourceMediaGrid.mediaListActionTarget")}
								as="section"
								class="block min-w-0 w-full"
								onContextMenu={(event) => {
									const media = findMediaFromEventTarget(event.target);
									setContextMenuTarget(media);
									if (!media) {
										event.preventDefault();
										event.stopPropagation();
									}
								}}
								onPointerDown={(event) => {
									if (event.button === 2) {
										setContextMenuTarget(
											findMediaFromEventTarget(event.target),
										);
									}
								}}
							>
								<CollectionContent />
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
									{(media) => renderMenuActionItems(media, "context")}
								</Show>
							</MediaContextMenuContent>
						</ContextMenu>
					</Show>

					{/* Empty state */}
					<Show when={showEmptyState() && props.state().phase === "empty"}>
						{props.emptyState ?? (
							<EmptyState
								description={t(
									"sourceMediaGrid.changeYourSearchConditionsAndTryAgain",
								)}
								icon={<ScanSearch size={20} />}
								title={t("sourceMediaGrid.noSearchResultsFound")}
							>
								<Show when={props.onClearSearch}>
									<Button onClick={props.onClearSearch} variant="outline">
										{t("actions.clearSearchConditions")}
									</Button>
								</Show>
							</EmptyState>
						)}
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
										fallback={
											<Show
												fallback={
													<p>{t("sourceMediaGrid.scrollToLoadMore")}</p>
												}
												when={props.onLoadMore}
											>
												<Button
													class="min-h-11 sm:min-h-9"
													onClick={props.onLoadMore}
													size="sm"
													variant="outline"
												>
													{t("actions.loadMore")}
												</Button>
											</Show>
										}
									>
										<Button
											class="min-h-11 sm:min-h-9"
											onClick={props.onLoadMore}
											size="sm"
											variant="outline"
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
