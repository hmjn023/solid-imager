import { t } from "@solid-imager/i18n";
import type { Character } from "@solid-imager/core/characters";
import type { Ip } from "@solid-imager/core/ips";
import { type Author } from "@solid-imager/core/authors";
import {
	type DownloadItem,
	type MediaSearchRequest,
	type MediaSearchResponse,
	downloadItemSchema,
	type UploadResponse,
} from "@solid-imager/core/media";
import type { Project } from "@solid-imager/core/projects";
import {
	getSearchConditionFromState,
	type SemanticSearchRequest,
} from "@solid-imager/core/search";
import type { JobProgressEvent } from "@solid-imager/core/events";
import type { TagResponse } from "@solid-imager/core/tags";
import { getErrorMessage } from "@solid-imager/core/utils";
import type { QueryClient } from "@tanstack/solid-query";
import { createInfiniteQuery, type InfiniteData } from "@tanstack/solid-query";
import type { Accessor, Setter } from "solid-js";
import {
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	onMount,
} from "solid-js";
import { isServer } from "solid-js/web";
import { z } from "zod";
import {
	buildSourceMediaResultsQueryOptions,
	isSourceMediaResultsQueryKey,
	removeMediaFromInfiniteQueryData,
	sourceMediaQueryKeys,
} from "../query-options";
import { SEARCH_COLLECTION_PAGE_SIZE } from "../query-options/search-query";
import { type QueryUiState, toQueryUiState } from "../query-state";
import {
	useInitialSearch,
	useRenderedSearchState,
} from "../search-initial-state";
import type { PresetManagerClient } from "../search-control-panel";
import { toast } from "../toast";
import { getGlobalSimilarityActivation } from "../stores/search-store";
import {
	getScrollPosition,
	setScrollPosition,
} from "../stores/source-scroll-store";
import { scrollToPosition, useScrollRestoration } from "./scroll-container";
import { createStableMediaResults } from "./stable-media-results";
import { useMediaItemActions } from "./use-media-collection-actions";
import type { MediaSourceEventTransport } from "./use-media-source-events";
import { useMediaSourceEvents } from "./use-media-source-events";

export const SOURCE_MEDIA_ITEMS_PER_PAGE = SEARCH_COLLECTION_PAGE_SIZE;
const DEBOUNCE_DELAY_MS = 1000;
const MEDIA_REFRESH_DEBOUNCE_MS = 300;

export type UploadOptions = {
	reservationId?: string;
	file: File;
	filename: string;
	description: string;
	sourceUrl?: string;
	overwrite: boolean;
	autoIncrement: boolean;
};

export type SourceMediaPageFilterData = {
	tags: TagResponse[] | undefined;
	projects: Project[] | undefined;
	ips: Ip[] | undefined;
	characters: Character[] | undefined;
	authors: Author[] | undefined;
};

export type SourceMediaPageQueries = {
	tags: Accessor<TagResponse[] | undefined>;
	projects: Accessor<Project[] | undefined>;
	ips: Accessor<Ip[] | undefined>;
	characters: Accessor<Character[] | undefined>;
	authors: Accessor<Author[] | undefined>;
};

export type SourceMediaPageQueryStates = {
	tags: QueryUiState<TagResponse[]>;
	projects: QueryUiState<Project[]>;
	ips: QueryUiState<Ip[]>;
	characters: QueryUiState<Character[]>;
	authors: QueryUiState<Author[]>;
};

export type SourceMediaPageActions = {
	searchSimilar?: import("../query-options").SourceMediaResultsQueryOptionsInput["searchSimilar"];
	searchSemantic: (
		input: SemanticSearchRequest,
		signal?: AbortSignal,
	) => Promise<MediaSearchResponse>;
	searchMedia: (
		sourceId: string,
		params: MediaSearchRequest,
		signal?: AbortSignal,
	) => Promise<MediaSearchResponse>;
	uploadMedia: (
		sourceId: string,
		file: File,
		opts: Omit<UploadOptions, "file">,
	) => Promise<UploadResponse>;
	deleteMedia: (sourceId: string, mediaId: string) => Promise<unknown>;
	copyMedia: (mediaId: string, targetId: string) => Promise<unknown>;
	moveMedia: (mediaId: string, targetId: string) => Promise<unknown>;
	syncMediaItems: (sourceId: string, ids: string[]) => Promise<unknown>;
	startDownloadJobs: (
		sourceId: string,
		items: DownloadItem[],
	) => Promise<unknown>;
};

export type SourceMediaPagePresetClient = PresetManagerClient;

export type UseSourceMediaPageOptions = {
	mediaSourceId: () => string | undefined;
	queries: SourceMediaPageQueries;
	queryStates: () => SourceMediaPageQueryStates;
	actions: SourceMediaPageActions;
	queryClient: QueryClient;
	presetClient: SourceMediaPagePresetClient;
	transport: MediaSourceEventTransport;
	getSearchCondition: () => MediaSearchRequest["condition"];
	sortBy: () => MediaSearchRequest["sort"];
	sortOrder: () => "asc" | "desc";
	itemsPerPage?: number;
	onThumbnailReady?: (mediaId: string) => void;
	onViewJobs?: () => void;
	isSearchStateRestored?: Accessor<boolean>;
	commitSearchHistory?: () => void;
	historyEntryKey?: Accessor<string | undefined>;
	enableVirtualization?: boolean;
	scrollContainerSelector?: string;
};

export type UseSourceMediaPageResult = {
	mediaSourceId: () => string | undefined;
	mediaQuery: ReturnType<typeof createInfiniteQuery<MediaSearchResponse>>;
	mediaResults: () => MediaSearchResponse["media"];
	fetchNextPage: () => Promise<unknown>;
	hasData: () => boolean;
	totalCount: () => number | undefined;
	contentState: () => QueryUiState<MediaSearchResponse["media"]>;
	filterData: () => SourceMediaPageFilterData;
	filterStates: () => SourceMediaPageQueryStates;
	handleSearch: () => void;
	loadMoreRef: () => HTMLDivElement | undefined;
	setLoadMoreRef: (el: HTMLDivElement) => void;
	showUploadModal: () => boolean;
	setShowUploadModal: Setter<boolean>;
	filesToUpload: Accessor<File[]>;
	setFilesToUpload: Setter<File[]>;
	fileToUpload: () => File | null;
	setFileToUpload: Setter<File | null>;
	pastedUrl: () => string | null;
	setPastedUrl: Setter<string | null>;
	deleteDialogOpen: () => boolean;
	setDeleteDialogOpen: (open: boolean) => void;
	deleteFileName: () => string | undefined;
	isDeletingMedia: () => boolean;
	deleteError: () => string | undefined;
	moveCopyDialogOpen: () => boolean;
	setMoveCopyDialogOpen: (open: boolean) => void;
	moveCopyMode: () => "copy" | "move";
	moveCopySourceId: () => string | undefined;
	isMoveCopySubmitting: () => boolean;
	moveCopyError: () => string | undefined;
	contextMenuMediaId: () => string | null;
	setContextMenuMediaId: (
		value: string | null | ((prev: string | null) => string | null),
	) => void;
	isSyncingMedia: () => boolean;
	jobProgress: () => JobProgressEvent | null;
	presetClient: SourceMediaPagePresetClient;
	handleUpload: (options: UploadOptions) => Promise<void>;
	handleFileSelect: (e: Event) => Promise<void>;
	handleAddButtonClick: () => void;
	handleDrop: (e: DragEvent) => void;
	handleDragOver: (e: DragEvent) => void;
	handleDelete: (mediaId: string) => void;
	confirmDelete: () => Promise<void>;
	handleCopyMove: (mediaId: string, mode: "copy" | "move") => void;
	handleConfirmCopyMove: (targetSourceId: string) => Promise<void>;
	handleSyncLoadedMedia: () => Promise<void>;
	handleSyncSingleMedia: (mediaId: string) => Promise<void>;
	fileInputRef: HTMLInputElement | undefined;
	setFileInputRef: (el: HTMLInputElement) => void;
};

export function useSourceMediaPage(
	options: UseSourceMediaPageOptions,
): UseSourceMediaPageResult {
	const {
		mediaSourceId,
		queries,
		queryStates,
		actions,
		queryClient,
		presetClient,
		transport,
		getSearchCondition,
		sortBy,
		sortOrder,
		itemsPerPage = SOURCE_MEDIA_ITEMS_PER_PAGE,
		onThumbnailReady,
		onViewJobs,
		isSearchStateRestored = () => true,
		commitSearchHistory,
		historyEntryKey,
		enableVirtualization = false,
	} = options;

	const navigateToJobs = () => {
		if (onViewJobs) {
			onViewJobs();
			return;
		}
		if (typeof window === "undefined") return;
		if (window.location.hash.startsWith("#/")) {
			window.location.hash = "#/jobs";
			return;
		}
		window.location.assign("/jobs");
	};

	const id = mediaSourceId;
	const initialSearch = useInitialSearch()?.initial;
	const state = useRenderedSearchState();
	// Global Find Similar sets shared search state before navigation can unmount
	// this view. Its successor owns that request; do not launch a transient
	// source-scoped query that will immediately be cancelled by navigation.
	const sourceActivation = getGlobalSimilarityActivation();
	// --- Filter data queries ---
	const filterData = (): SourceMediaPageFilterData => ({
		tags: queries.tags(),
		projects: queries.projects(),
		ips: queries.ips(),
		characters: queries.characters(),
		authors: queries.authors(),
	});

	// --- Infinite query ---
	const mediaQueryOptions = createMemo(() => {
		const initial = initialSearch?.()?.state;
		const condition = initial
			? getSearchConditionFromState(initial)
			: getSearchCondition();
		return buildSourceMediaResultsQueryOptions({
			similarityAnchorMediaId: state().similarityAnchorMediaId,
			similarityModel: state().similarityModel,
			searchSimilar: actions.searchSimilar,
			semanticQuery: state().semanticQuery,
			similarityTopK: state().similarityTopK,
			searchSemantic: actions.searchSemantic,
			sourceId: id(),
			condition,
			conditionKey: JSON.stringify(condition ?? null),
			sort: initial?.sortBy ?? sortBy(),
			order: initial?.sortOrder ?? sortOrder(),
			limit: itemsPerPage,
			searchMedia: actions.searchMedia,
			enabled:
				!isServer &&
				isSearchStateRestored() &&
				!!id() &&
				getGlobalSimilarityActivation() === sourceActivation,
		});
	});
	const mediaQuery = createInfiniteQuery(mediaQueryOptions);
	const [mediaQueryData, setMediaQueryData] = createSignal<
		InfiniteData<MediaSearchResponse> | undefined
	>(
		initialSearch?.()
			? queryClient.getQueryData(mediaQueryOptions().queryKey)
			: undefined,
	);

	createEffect(() => {
		// Keep paginated results outside Solid Query's resource-backed `data`
		// accessor. A page fetch must not suspend and remount the media grid.
		const queryKey = mediaQueryOptions().queryKey;
		void mediaQuery.dataUpdatedAt;
		const cachedData =
			queryClient.getQueryData<InfiniteData<MediaSearchResponse>>(queryKey);
		if (cachedData !== undefined) {
			setMediaQueryData(cachedData);
		} else if (!mediaQuery.isPlaceholderData) {
			setMediaQueryData(undefined);
		}
	});

	// Preserve existing media cards across background refetches. New query
	// objects are reconciled by media ID so only genuinely added or removed
	// cards mount and unmount.
	const mediaResults = createStableMediaResults(mediaQueryData);
	const contentState = () =>
		toQueryUiState(
			{
				data: mediaQueryData() ? mediaResults() : undefined,
				error: mediaQuery.error,
				status: mediaQuery.status,
				fetchStatus: mediaQuery.fetchStatus,
			},
			{ isEmpty: (data) => data.length === 0 },
		);

	// --- Search handler ---
	const handleSearch = () => {
		commitSearchHistory?.();
		const sourceId = id();
		if (sourceId) setScrollPosition(sourceId, 0, historyEntryKey?.());
		scrollToPosition(options.scrollContainerSelector, 0);
	};

	let nextPageFetchInFlight = false;
	const fetchNextPage = async (): Promise<unknown> => {
		if (
			!isSearchStateRestored() ||
			nextPageFetchInFlight ||
			!mediaQuery.hasNextPage ||
			mediaQuery.isFetchingNextPage
		) {
			return;
		}
		nextPageFetchInFlight = true;
		try {
			return await mediaQuery.fetchNextPage({ cancelRefetch: false });
		} finally {
			nextPageFetchInFlight = false;
		}
	};

	// --- Scroll restoration ---
	useScrollRestoration({
		restoreKey: () => historyEntryKey?.() ?? id(),
		getPosition: () => {
			const sourceId = id();
			return sourceId ? getScrollPosition(sourceId, historyEntryKey?.()) : 0;
		},
		setPosition: (_key, position) => {
			const sourceId = id();
			if (sourceId) {
				setScrollPosition(sourceId, position, historyEntryKey?.());
			}
		},
		isReady: () => Boolean(mediaQueryData()) && !mediaQuery.isLoading,
		hasNextPage: () => mediaQuery.hasNextPage,
		isFetchingNextPage: () => mediaQuery.isFetchingNextPage,
		fetchNextPage,
		scrollContainerSelector: options.scrollContainerSelector,
	});

	// --- Infinite scroll ---
	// Virtualized grids own their load-more threshold. Their sentinel is mounted
	// before the first layout measurement and would otherwise look visible at
	// the top of the page, causing an eager second-page request on navigation.
	const [loadMoreRef, setLoadMoreRef] = createSignal<
		HTMLDivElement | undefined
	>(undefined);

	onMount(() => {
		if (enableVirtualization) {
			return;
		}
		createEffect(() => {
			const el = loadMoreRef();
			if (
				!el ||
				!mediaQuery.hasNextPage ||
				mediaQuery.isFetchingNextPage ||
				mediaQuery.isFetchNextPageError
			) {
				return;
			}
			void mediaResults().length;

			const observer = new IntersectionObserver(
				(entries) => {
					if (
						entries[0]?.isIntersecting &&
						mediaQuery.hasNextPage &&
						!mediaQuery.isFetchingNextPage &&
						!mediaQuery.isFetchNextPageError
					) {
						void fetchNextPage();
					}
				},
				{ threshold: 0.5, rootMargin: "2400px" },
			);

			observer.observe(el);
			onCleanup(() => observer.disconnect());
		});
	});

	// --- UI state ---
	const [showUploadModal, setShowUploadModal] = createSignal(false);
	const [filesToUpload, setFilesToUpload] = createSignal<File[]>([]);
	const fileToUpload = () => filesToUpload()[0] ?? null;
	const setFileToUpload: Setter<File | null> = (value) =>
		setFilesToUpload((previous) => {
			const resolved =
				typeof value === "function" ? value(previous[0] ?? null) : value;
			return resolved ? [resolved] : [];
		});
	const [pastedUrl, setPastedUrl] = createSignal<string | null>(null);
	const [contextMenuMediaId, setContextMenuMediaId] = createSignal<
		string | null
	>(null);
	const [isSyncingMedia, setIsSyncingMedia] = createSignal(false);
	const [jobProgress, setJobProgress] = createSignal<JobProgressEvent | null>(
		null,
	);

	let fileInputRef: HTMLInputElement | undefined;
	const setFileInputRef = (el: HTMLInputElement) => {
		fileInputRef = el;
	};

	// --- Refresh helpers ---
	const refreshMediaQuery = () => {
		void mediaQuery.refetch();
	};

	const [mediaRefreshTimer, setMediaRefreshTimer] = createSignal<ReturnType<
		typeof setTimeout
	> | null>(null);

	const scheduleMediaRefresh = () => {
		const timer = mediaRefreshTimer();
		if (timer) {
			clearTimeout(timer);
		}
		setMediaRefreshTimer(
			setTimeout(() => {
				refreshMediaQuery();
				setMediaRefreshTimer(null);
			}, MEDIA_REFRESH_DEBOUNCE_MS),
		);
	};

	// --- Debounce for media-added events ---
	const [addedCount, setAddedCount] = createSignal(0);
	const [debounceTimer, setDebounceTimer] = createSignal<ReturnType<
		typeof setTimeout
	> | null>(null);

	onCleanup(() => {
		const timer = debounceTimer();
		if (timer) {
			clearTimeout(timer);
		}
		const refreshTimer = mediaRefreshTimer();
		if (refreshTimer) {
			clearTimeout(refreshTimer);
		}
	});

	// --- Media source events ---
	useMediaSourceEvents({
		transport,
		onMediaAdded: () => {
			setAddedCount((prev) => prev + 1);

			const timer = debounceTimer();
			if (timer) {
				clearTimeout(timer);
			}

			setDebounceTimer(
				setTimeout(() => {
					const count = addedCount();
					if (count > 0) {
						toast.success(
							t("useSourceMediaPage.valueNewMediaDetectedRefreshingList", {
								value0: String(count),
							}),
						);
						setAddedCount(0);
					}
					refreshMediaQuery();
				}, DEBOUNCE_DELAY_MS),
			);
		},
		onMediaDeleted: (data) => {
			const sourceId = id();
			if (!sourceId) {
				return;
			}
			queryClient.setQueriesData<InfiniteData<MediaSearchResponse>>(
				{
					predicate: (query) =>
						isSourceMediaResultsQueryKey(query.queryKey, sourceId),
				},
				(previous) => removeMediaFromInfiniteQueryData(previous, data.mediaId),
			);
			scheduleMediaRefresh();
		},
		onMediaChanged: () => {
			scheduleMediaRefresh();
		},
		onMediaCopied: () => {
			scheduleMediaRefresh();
		},
		onMediaMoved: () => {
			scheduleMediaRefresh();
		},
		onThumbnailGenerated: (data) => {
			if (onThumbnailReady) {
				onThumbnailReady(data.mediaId);
			}
		},
		onAllJobsCompleted: (data) => {
			setJobProgress(null);
			toast.success(
				t("useSourceMediaPage.allJobsCompletedProcessedValue", {
					value0: String(data.processed ?? t("useSourceMediaPage.nA")),
				}),
			);
			refreshMediaQuery();
		},
		onWatcherError: (data) => {
			toast.error(
				t("useSourceMediaPage.watcherErrorValue", {
					value0: String(data.error || t("feedback.unknownError")),
				}),
			);
		},
	});

	// --- Handlers ---
	const handleUpload = async (options: UploadOptions) => {
		const result = await actions.uploadMedia(id() || "", options.file, {
			filename: options.filename,
			reservationId: options.reservationId,
			description: options.description,
			sourceUrl: options.sourceUrl,
			overwrite: options.overwrite,
			autoIncrement: options.autoIncrement,
		});
		if (!result.success) {
			toast.info(
				t("useSourceMediaPage.skippedValueBecauseItAlreadyExists", {
					value0: String(result.conflict?.existingFile ?? options.filename),
				}),
			);
			return;
		}
		toast.success(t("useSourceMediaPage.mediaUploadedSuccessfully"));
		refreshMediaQuery();
	};

	const handleJsonFileUpload = async (file: File) => {
		try {
			const text = await file.text();
			const jsonContent: unknown = JSON.parse(text);
			const record =
				typeof jsonContent === "object" &&
				jsonContent !== null &&
				!Array.isArray(jsonContent)
					? jsonContent
					: null;
			const candidateItems = Array.isArray(jsonContent)
				? jsonContent
				: record && "items" in record && Array.isArray(record.items)
					? record.items
					: null;
			if (!candidateItems) {
				throw new Error(
					t("useSourceMediaPage.theJSONFileMustBeAnArrayOfItems"),
				);
			}
			const parsedItems = z.array(downloadItemSchema).safeParse(candidateItems);
			if (!parsedItems.success) {
				throw new Error(
					t("useSourceMediaPage.theJSONFileContainsInvalidDownloadData"),
				);
			}
			const items: DownloadItem[] = parsedItems.data;

			if (items.length === 0) {
				throw new Error(
					t("useSourceMediaPage.theJSONFileContainsNoItemsToDownload"),
				);
			}

			await actions.startDownloadJobs(id() || "", items);
			toast.success(t("useSourceMediaPage.bulkDownloadStarted"), {
				duration: 7_000,
				action: {
					label: t("actions.viewJobs"),
					onClick: navigateToJobs,
				},
			});
		} catch (error) {
			toast.error(
				t("useSourceMediaPage.failedToStartDownloadValue", {
					value0: String(getErrorMessage(error)),
				}),
			);
		}
	};

	const handleFileSelect = async (e: Event) => {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			const selected = Array.from(target.files);
			const jsonFiles: File[] = [];
			const mediaFiles: File[] = [];
			for (const file of selected) {
				if (
					file.type === "application/json" ||
					file.name.toLowerCase().endsWith(".json")
				) {
					jsonFiles.push(file);
				} else {
					mediaFiles.push(file);
				}
			}

			for (const jsonFile of jsonFiles) {
				await handleJsonFileUpload(jsonFile);
			}
			if (mediaFiles.length > 0) {
				setFilesToUpload(mediaFiles);
				setShowUploadModal(true);
			}

			target.value = "";
		}
	};

	const handleAddButtonClick = () => {
		fileInputRef?.click();
	};

	const handleDrop = (e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
			setFilesToUpload(Array.from(e.dataTransfer.files));
			setShowUploadModal(true);
		}
	};

	const handleDragOver = (e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
	};

	const handleImagePasteItem = (
		item: DataTransferItem,
		e: ClipboardEvent,
	): boolean => {
		if (item.type.indexOf("image") !== -1) {
			const blob = item.getAsFile();
			if (blob) {
				const subtype = blob.type.split("/")[1]?.split(";")[0];
				const extension =
					blob.type === "image/jpeg"
						? "jpg"
						: subtype?.replace(/[^a-z0-9]/gi, "") || "png";
				const file = new File(
					[blob],
					`pasted-image-${Date.now()}.${extension}`,
					{
						type: blob.type,
					},
				);
				setFileToUpload(file);
				setShowUploadModal(true);
				e.preventDefault();
				return true;
			}
		}
		return false;
	};

	const handleUrlPasteItem = async (
		item: DataTransferItem,
		e: ClipboardEvent,
	): Promise<boolean> => {
		if (item.type === "text/plain") {
			const text = await new Promise<string | null>((resolve) => {
				item.getAsString((str) => resolve(str));
			});

			const normalizedText = text?.trim();
			if (normalizedText && z.url().safeParse(normalizedText).success) {
				setPastedUrl(normalizedText);
				setShowUploadModal(true);
				e.preventDefault();
				return true;
			}
		}
		return false;
	};

	const processClipboardItems = async (
		items: DataTransferItemList,
		e: ClipboardEvent,
	): Promise<boolean> => {
		for (const item of items) {
			if (handleImagePasteItem(item, e)) {
				return true;
			}
		}

		for (const item of items) {
			if (await handleUrlPasteItem(item, e)) {
				return true;
			}
		}

		return false;
	};

	const handlePaste = async (e: ClipboardEvent) => {
		const target = e.target;
		if (
			e.defaultPrevented ||
			(target instanceof Element &&
				(target.closest("input, textarea, select, [contenteditable]") ||
					target.closest("[role='textbox']")))
		) {
			return;
		}
		if (!e.clipboardData?.items) {
			return;
		}
		await processClipboardItems(e.clipboardData.items, e);
	};
	const handlePasteListener = (event: ClipboardEvent) => {
		void handlePaste(event);
	};

	onMount(() => {
		document.addEventListener("paste", handlePasteListener);
		onCleanup(() => {
			document.removeEventListener("paste", handlePasteListener);
		});
	});

	const itemActions = useMediaItemActions({
		findMedia: (mediaId) => {
			const sourceId = id();
			if (!sourceId) return;
			return {
				id: mediaId,
				mediaSourceId: sourceId,
				fileName: mediaResults().find((media) => media.id === mediaId)
					?.fileName,
			};
		},
		operations: actions,
		notify: toast,
		onDeleted: refreshMediaQuery,
		onTransferred: (_media, targetSourceId) => {
			refreshMediaQuery();
			void queryClient.invalidateQueries({
				queryKey: sourceMediaQueryKeys.forSource(targetSourceId),
			});
		},
	});

	const handleSyncLoadedMedia = async () => {
		const allPages = mediaQueryData()?.pages;
		if (!allPages || isSyncingMedia()) {
			return;
		}
		const mediaIds = allPages.flatMap((page) => page.media).map((m) => m.id);

		if (mediaIds.length === 0) {
			return;
		}

		setIsSyncingMedia(true);
		toast.info(t("useSourceMediaPage.startingBatchSyncForLoadedMedia"));
		try {
			await actions.syncMediaItems(id() || "", mediaIds);
			toast.success(
				t("useSourceMediaPage.batchSyncCompletedForValueItems", {
					value0: String(mediaIds.length),
				}),
			);
			refreshMediaQuery();
		} catch (error) {
			toast.error(
				t("useSourceMediaPage.failedToBatchSyncValue", {
					value0: String(getErrorMessage(error)),
				}),
			);
		} finally {
			setIsSyncingMedia(false);
		}
	};

	const handleSyncSingleMedia = async (mediaId: string) => {
		toast.info(t("useSourceMediaPage.startingMetadataSync"));
		try {
			await actions.syncMediaItems(id() || "", [mediaId]);
			toast.success(t("useSourceMediaPage.metadataSyncedSuccessfully"));
			refreshMediaQuery();
		} catch (e) {
			toast.error(
				t("useSourceMediaPage.failedToSyncMetadataValue", {
					value0: String(getErrorMessage(e)),
				}),
			);
		}
	};

	return {
		mediaSourceId: id,
		mediaQuery,
		mediaResults,
		fetchNextPage,
		hasData: () => mediaQueryData() !== undefined,
		totalCount: () => mediaQueryData()?.pages[0]?.total,
		contentState,
		filterData,
		filterStates: queryStates,
		handleSearch,
		loadMoreRef,
		setLoadMoreRef,
		showUploadModal,
		setShowUploadModal,
		filesToUpload,
		setFilesToUpload,
		fileToUpload,
		setFileToUpload,
		pastedUrl,
		setPastedUrl,
		deleteDialogOpen: itemActions.isDeleteDialogOpen,
		setDeleteDialogOpen: itemActions.changeDeleteOpen,
		deleteFileName: () => itemActions.deleteTarget()?.fileName,
		isDeletingMedia: itemActions.isDeleteSubmitting,
		deleteError: itemActions.deleteError,
		moveCopyDialogOpen: itemActions.isMoveCopyDialogOpen,
		setMoveCopyDialogOpen: itemActions.changeCopyMoveOpen,
		moveCopyMode: itemActions.moveCopyMode,
		moveCopySourceId: () => itemActions.moveCopyTarget()?.mediaSourceId,
		isMoveCopySubmitting: itemActions.isMoveCopySubmitting,
		moveCopyError: itemActions.moveCopyError,
		contextMenuMediaId,
		setContextMenuMediaId,
		isSyncingMedia,
		jobProgress,
		presetClient,
		handleUpload,
		handleFileSelect,
		handleAddButtonClick,
		handleDrop,
		handleDragOver,
		handleDelete: itemActions.openDelete,
		confirmDelete: itemActions.confirmDelete,
		handleCopyMove: itemActions.openCopyMove,
		handleConfirmCopyMove: itemActions.confirmCopyMove,
		handleSyncLoadedMedia,
		handleSyncSingleMedia,
		fileInputRef,
		setFileInputRef,
	};
}
