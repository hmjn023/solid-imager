import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type { JobDto } from "@solid-imager/core/domain/jobs/schemas";
import type {
	Author,
	DownloadItem,
	MediaSearchRequest,
	MediaSearchResponse,
} from "@solid-imager/core/domain/media/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
import type { JobProgressEvent } from "@solid-imager/core/domain/sources/events";
import {
	getScrollPosition,
	setScrollPosition,
} from "@solid-imager/core/domain/sources/store";
import type { TagResponse } from "@solid-imager/core/domain/tags/schemas";
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
import { type QueryUiState, toQueryUiState } from "../query-state";
import type { PresetManagerClient } from "../search-control-panel";
import { toast } from "../toast";
import { getRestoreImportStrategies } from "./restore-import";
import { scrollToPosition, useScrollRestoration } from "./scroll-container";
import type { MediaSourceEventTransport } from "./use-media-source-events";
import { useMediaSourceEvents } from "./use-media-source-events";

export const SOURCE_MEDIA_ITEMS_PER_PAGE = 200;
const DEBOUNCE_DELAY_MS = 1000;
const MEDIA_REFRESH_DEBOUNCE_MS = 300;

export type UploadOptions = {
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
	searchMedia: (
		sourceId: string,
		params: MediaSearchRequest,
		signal?: AbortSignal,
	) => Promise<MediaSearchResponse>;
	uploadMedia: (
		sourceId: string,
		file: File,
		opts: Omit<UploadOptions, "file">,
	) => Promise<unknown>;
	deleteMedia: (sourceId: string, mediaId: string) => Promise<unknown>;
	copyMedia: (
		sourceId: string,
		mediaId: string,
		targetId: string,
	) => Promise<unknown>;
	moveMedia: (
		sourceId: string,
		mediaId: string,
		targetId: string,
	) => Promise<unknown>;
	syncMediaItems: (sourceId: string, ids: string[]) => Promise<unknown>;
	startDownloadJobs: (
		sourceId: string,
		items: DownloadItem[],
	) => Promise<unknown>;
	fetchSourceDump: (
		sourceId: string,
		mode: "json" | "zip",
		opts?: { includeImages?: boolean },
	) => Promise<Blob>;
	restoreSource: (
		sourceId: string,
		data: unknown,
		opts?: {
			signal?: AbortSignal;
			onProgress?: (done: number, total: number) => void;
		},
	) => Promise<{
		processed: number;
		skipped: number;
		errors: string[];
		cancelled?: boolean;
	}>;
	importSourceZip: (sourceId: string, file: File) => Promise<JobDto>;
	importSourceNdjson?: (sourceId: string, file: File) => Promise<JobDto>;
	parseRestoreFile?: (file: File) => Promise<unknown>;
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
	fileToUpload: () => File | null;
	setFileToUpload: Setter<File | null>;
	pastedUrl: () => string | null;
	setPastedUrl: Setter<string | null>;
	deleteDialogOpen: () => boolean;
	setDeleteDialogOpen: Setter<boolean>;
	moveCopyDialogOpen: () => boolean;
	setMoveCopyDialogOpen: Setter<boolean>;
	moveCopyMode: () => "copy" | "move";
	contextMenuMediaId: () => string | null;
	setContextMenuMediaId: (
		value: string | null | ((prev: string | null) => string | null),
	) => void;
	isSyncingMedia: () => boolean;
	jobProgress: () => JobProgressEvent | null;
	presetClient: SourceMediaPagePresetClient;
	handleUpload: (options: UploadOptions) => Promise<void>;
	handleFileSelect: (e: Event) => Promise<void>;
	handleDumpDownload: (mode?: "json" | "zip") => Promise<void>;
	handleRestoreSelect: (e: Event) => Promise<void>;
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
	restoreInputRef: HTMLInputElement | undefined;
	setRestoreInputRef: (el: HTMLInputElement) => void;
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
		isSearchStateRestored = () => true,
		commitSearchHistory,
		historyEntryKey,
		enableVirtualization = false,
	} = options;

	const id = mediaSourceId;
	// --- Filter data queries ---
	const filterData = (): SourceMediaPageFilterData => ({
		tags: queries.tags(),
		projects: queries.projects(),
		ips: queries.ips(),
		characters: queries.characters(),
		authors: queries.authors(),
	});

	// --- Infinite query ---
	const searchConditionKey = createMemo(() =>
		JSON.stringify(getSearchCondition() ?? null),
	);

	const mediaQueryOptions = createMemo(() =>
		buildSourceMediaResultsQueryOptions({
			sourceId: id(),
			condition: getSearchCondition(),
			conditionKey: searchConditionKey(),
			sort: sortBy(),
			order: sortOrder(),
			limit: itemsPerPage,
			searchMedia: actions.searchMedia,
			enabled: !isServer && isSearchStateRestored() && !!id(),
		}),
	);
	const mediaQuery = createInfiniteQuery(mediaQueryOptions);
	const [mediaQueryData, setMediaQueryData] = createSignal<
		InfiniteData<MediaSearchResponse> | undefined
	>();

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

	// --- Deduplicated results ---
	const mediaResults = createMemo(() => {
		const seen = new Set<string>();
		return (mediaQueryData()?.pages.flatMap((page) => page.media) || []).filter(
			(media) => {
				if (seen.has(media.id)) {
					return false;
				}
				seen.add(media.id);
				return true;
			},
		);
	});
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
			nextPageFetchInFlight ||
			!mediaQuery.hasNextPage ||
			mediaQuery.isFetchingNextPage
		) {
			return;
		}
		nextPageFetchInFlight = true;
		try {
			return await mediaQuery.fetchNextPage();
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
			if (!el) {
				return;
			}

			const hasNext = mediaQuery.hasNextPage;
			void hasNext;

			const observer = new IntersectionObserver(
				(entries) => {
					if (
						entries[0].isIntersecting &&
						mediaQuery.hasNextPage &&
						!mediaQuery.isFetchingNextPage
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
	const [fileToUpload, setFileToUpload] = createSignal<File | null>(null);
	const [pastedUrl, setPastedUrl] = createSignal<string | null>(null);
	const [deleteDialogOpen, setDeleteDialogOpen] = createSignal(false);
	const [mediaIdToDelete, setMediaIdToDelete] = createSignal<string | null>(
		null,
	);
	const [moveCopyDialogOpen, setMoveCopyDialogOpen] = createSignal(false);
	const [moveCopyMode, setMoveCopyMode] = createSignal<"copy" | "move">("copy");
	const [mediaIdToMoveCopy, setMediaIdToMoveCopy] = createSignal<string | null>(
		null,
	);
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
	let restoreInputRef: HTMLInputElement | undefined;
	const setRestoreInputRef = (el: HTMLInputElement) => {
		restoreInputRef = el;
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

	onCleanup(() => {
		if (restoreAbortController) {
			restoreAbortController.abort();
			restoreAbortController = null;
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
						toast.success(`${count} new media detected. Refreshing list...`);
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
				`All jobs completed! Processed: ${data.processed ?? "N/A"}`,
			);
			refreshMediaQuery();
		},
		onWatcherError: (data) => {
			toast.error(`Watcher Error: ${data.error || "Unknown error"}`);
		},
	});

	// --- Handlers ---
	const handleUpload = async (options: UploadOptions) => {
		await actions.uploadMedia(id() || "", options.file, {
			filename: options.filename,
			description: options.description,
			sourceUrl: options.sourceUrl,
			overwrite: options.overwrite,
			autoIncrement: options.autoIncrement,
		});
		toast.success("Media uploaded successfully");
		refreshMediaQuery();
	};

	const handleJsonFileUpload = async (file: File) => {
		try {
			const text = await file.text();
			const jsonContent = JSON.parse(text);
			let items: DownloadItem[] = [];

			if (Array.isArray(jsonContent)) {
				items = jsonContent;
			} else if (jsonContent.items && Array.isArray(jsonContent.items)) {
				items = jsonContent.items;
			} else if (jsonContent.images && Array.isArray(jsonContent.images)) {
				items = jsonContent.images.flatMap((image: Record<string, unknown>) => {
					const imageUrl =
						(typeof image.originalUrl === "string" && image.originalUrl) ||
						(typeof image.displayUrl === "string" && image.displayUrl);
					if (!imageUrl) {
						return [];
					}

					const metadata =
						typeof image.metadata === "object" && image.metadata
							? (image.metadata as Record<string, unknown>)
							: undefined;
					const postId =
						metadata && typeof metadata.postId === "string"
							? metadata.postId
							: undefined;
					const tweetUrl =
						image.source === "twitter" && postId
							? `https://twitter.com/i/web/status/${postId}`
							: undefined;
					const author =
						metadata && typeof metadata.author === "string"
							? metadata.author
							: undefined;
					const timestamp =
						metadata && typeof metadata.timestamp === "string"
							? metadata.timestamp
							: typeof image.date === "string"
								? image.date
								: undefined;

					return [
						{
							targetUrl: imageUrl,
							description:
								(metadata && typeof metadata.title === "string"
									? metadata.title
									: typeof image.title === "string"
										? image.title
										: undefined) ?? undefined,
							sourceUrls: tweetUrl ? [tweetUrl] : undefined,
							authors: author ? [{ name: author }] : undefined,
							createdAt: timestamp,
						},
					];
				});
			} else {
				throw new Error(
					"JSONファイルはアイテムの配列であるか、'items'または'images'キーを含むオブジェクトである必要があります。",
				);
			}

			if (items.length === 0) {
				throw new Error(
					"JSONファイルにはダウンロードするアイテムが含まれていません。",
				);
			}

			await actions.startDownloadJobs(id() || "", items);
			toast.success("Bulk download started");
		} catch (error) {
			toast.error(`Failed to start download: ${getErrorMessage(error)}`);
		}
	};

	const handleFileSelect = async (e: Event) => {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			const file = target.files[0];

			if (file.type === "application/json" || file.name.endsWith(".json")) {
				await handleJsonFileUpload(file);
			} else {
				setFileToUpload(file);
				setShowUploadModal(true);
			}

			target.value = "";
		}
	};

	const handleDumpDownload = async (mode: "json" | "zip" = "json") => {
		const sourceId = id();
		if (!sourceId) {
			return;
		}

		try {
			const blob = await actions.fetchSourceDump(sourceId, mode);
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download =
				mode === "json"
					? `source-${sourceId}-dump.ndjson`
					: `source-${sourceId}-dump.tar`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);
			toast.success(
				mode === "json"
					? "NDJSON dump downloaded successfully"
					: "TAR dump downloaded successfully",
			);
		} catch (_error) {
			toast.error("Failed to download dump");
		}
	};

	let restoreAbortController: AbortController | null = null;

	const handleRestoreSelect = async (e: Event) => {
		const target = e.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) {
			return;
		}

		const file = target.files[0];
		const sourceId = id();
		if (!sourceId) {
			return;
		}

		restoreAbortController = new AbortController();

		try {
			const strategies = getRestoreImportStrategies(file, {
				canImportNdjson: !!actions.importSourceNdjson,
			});

			if (strategies.includes("tar")) {
				toast.loading("Queueing TAR restore...", { id: "restore-toast" });
				const job = await actions.importSourceZip(sourceId, file);
				toast.success(
					`TAR restore queued (${job.id.slice(0, 8)}). Track it in Jobs.`,
					{
						id: "restore-toast",
					},
				);
				return;
			}

			if (strategies[0] === "ndjson" && actions.importSourceNdjson) {
				toast.loading("Queueing NDJSON restore...", { id: "restore-toast" });
				const job = await actions.importSourceNdjson(sourceId, file);
				toast.success(
					`NDJSON restore queued (${job.id.slice(0, 8)}). Track it in Jobs.`,
					{
						id: "restore-toast",
					},
				);
				return;
			}

			if (strategies[0] === "unsupported") {
				throw new Error("Unsupported dump format");
			}

			const data = actions.parseRestoreFile
				? await actions.parseRestoreFile(file)
				: JSON.parse(await file.text());

			const showCancel = typeof actions.parseRestoreFile === "function";
			const cancelAction = showCancel
				? {
						label: "Cancel",
						onClick: () => restoreAbortController?.abort(),
					}
				: undefined;

			toast.loading("Restoring metadata...", {
				id: "restore-toast",
				cancel: cancelAction,
			});

			const total = Array.isArray(data)
				? data.length
				: ((data as { media?: unknown[] })?.media?.length ?? 0);

			const result = await actions.restoreSource(sourceId, data, {
				signal: restoreAbortController.signal,
				onProgress: (done) => {
					toast.loading(`Restoring metadata... ${done}/${total} items`, {
						id: "restore-toast",
						cancel: cancelAction,
					});
				},
			});

			if (result.cancelled) {
				toast.info(`Restore cancelled: ${result.processed} items restored.`, {
					id: "restore-toast",
				});
			} else {
				toast.success(
					`Restore complete: ${result.processed} processed, ${result.skipped} skipped`,
					{
						id: "restore-toast",
					},
				);
			}
			refreshMediaQuery();
		} catch (error) {
			toast.error(`Restore failed: ${getErrorMessage(error)}`, {
				id: "restore-toast",
			});
		} finally {
			restoreAbortController = null;
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
			const file = e.dataTransfer.files[0];
			setFileToUpload(file);
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
				const file = new File([blob], `pasted-image-${Date.now()}.png`, {
					type: blob.type,
				});
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
			if (
				normalizedText &&
				z.string().url().safeParse(normalizedText).success
			) {
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

	onMount(() => {
		document.addEventListener("paste", handlePaste);
		onCleanup(() => {
			document.removeEventListener("paste", handlePaste);
		});
	});

	const handleDelete = (mediaId: string) => {
		setMediaIdToDelete(mediaId);
		setDeleteDialogOpen(true);
	};

	const confirmDelete = async () => {
		const mediaId = mediaIdToDelete();
		if (!mediaId) {
			return;
		}

		try {
			await actions.deleteMedia(id() || "", mediaId);
			toast.success("Media deleted successfully");
			refreshMediaQuery();
		} catch (_e) {
			toast.error("Failed to delete media");
		} finally {
			setDeleteDialogOpen(false);
			setMediaIdToDelete(null);
		}
	};

	const handleCopyMove = (mediaId: string, mode: "copy" | "move") => {
		setMediaIdToMoveCopy(mediaId);
		setMoveCopyMode(mode);
		setMoveCopyDialogOpen(true);
	};

	const handleConfirmCopyMove = async (targetSourceId: string) => {
		const mediaId = mediaIdToMoveCopy();
		const sourceId = id();
		if (!(mediaId && sourceId)) {
			return;
		}

		const mode = moveCopyMode();
		const action = mode === "copy" ? actions.copyMedia : actions.moveMedia;
		const actionName = mode === "copy" ? "copied" : "moved";

		try {
			await action(sourceId, mediaId, targetSourceId);
			toast.success(`Media ${actionName} successfully`);
			refreshMediaQuery();
			if (sourceId !== targetSourceId) {
				await queryClient.invalidateQueries({
					queryKey: sourceMediaQueryKeys.forSource(targetSourceId),
				});
			}
		} catch (e) {
			toast.error(`Failed to ${mode} media: ${getErrorMessage(e)}`);
		} finally {
			setMediaIdToMoveCopy(null);
		}
	};

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
		toast.info("Starting batch sync for loaded media...");
		try {
			await actions.syncMediaItems(id() || "", mediaIds);
			toast.success(`Batch sync completed for ${mediaIds.length} items`);
			refreshMediaQuery();
		} catch (error) {
			toast.error(`Failed to batch sync: ${getErrorMessage(error)}`);
		} finally {
			setIsSyncingMedia(false);
		}
	};

	const handleSyncSingleMedia = async (mediaId: string) => {
		toast.info("Starting metadata sync...");
		try {
			await actions.syncMediaItems(id() || "", [mediaId]);
			toast.success("Metadata synced successfully");
			refreshMediaQuery();
		} catch (e) {
			toast.error(`Failed to sync metadata: ${getErrorMessage(e)}`);
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
		fileToUpload,
		setFileToUpload,
		pastedUrl,
		setPastedUrl,
		deleteDialogOpen,
		setDeleteDialogOpen,
		moveCopyDialogOpen,
		setMoveCopyDialogOpen,
		moveCopyMode,
		contextMenuMediaId,
		setContextMenuMediaId,
		isSyncingMedia,
		jobProgress,
		presetClient,
		handleUpload,
		handleFileSelect,
		handleDumpDownload,
		handleRestoreSelect,
		handleAddButtonClick,
		handleDrop,
		handleDragOver,
		handleDelete,
		confirmDelete,
		handleCopyMove,
		handleConfirmCopyMove,
		handleSyncLoadedMedia,
		handleSyncSingleMedia,
		fileInputRef,
		setFileInputRef,
		restoreInputRef,
		setRestoreInputRef,
	};
}
