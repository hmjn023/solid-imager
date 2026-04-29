import type { DownloadItem } from "@solid-imager/core/domain/media/schemas";
import {
	getScrollPosition,
	setScrollPosition,
} from "@solid-imager/core/domain/sources/store";
import { Button } from "@solid-imager/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@solid-imager/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@solid-imager/ui/dialog";
import { SearchControlPanel } from "@solid-imager/ui/search-control-panel";
import { toast } from "@solid-imager/ui/toast";
import {
	createInfiniteQuery,
	createQuery,
	keepPreviousData,
	useQueryClient,
} from "@tanstack/solid-query";
import { useParams } from "@tanstack/solid-router";
import {
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	onMount,
} from "solid-js";
import { isServer } from "solid-js/web";
import { z } from "zod";
import { MoveCopyMediaDialog } from "~/components/media/move-copy-media-dialog";
import { UploadMediaModal } from "~/components/upload-media-modal";
import { useCurrentSearchPersistence } from "~/hooks/use-current-search-persistence";
import { useMediaSourceEvents } from "~/hooks/use-media-source-events";
import { PresetClient } from "~/infrastructure/api/clients/preset-client";
import { startDownloadJobs } from "~/infrastructure/api-clients/downloads-api";
import {
	copyMedia,
	deleteMedia,
	moveMedia,
	syncMediaItems,
	uploadMedia,
} from "~/infrastructure/api-clients/media-api";
import { allAuthorsQueryOptions } from "~/infrastructure/api-clients/queries/authors-query";
import { allCharactersQueryOptions } from "~/infrastructure/api-clients/queries/characters-query";
import { allIpsQueryOptions } from "~/infrastructure/api-clients/queries/ips-query";
import { allProjectsQueryOptions } from "~/infrastructure/api-clients/queries/projects-query";
import { tagsQueryOptions } from "~/infrastructure/api-clients/queries/tags-query";
import { searchMedia } from "~/infrastructure/api-clients/search-api";
import {
	fetchSourceDump,
	importSourceZip,
	restoreSource,
} from "~/infrastructure/api-clients/sources-api";
import { logger } from "~/infrastructure/logger";
import {
	getSearchCondition,
	searchState,
} from "~/presentation/store/search-store";
import { MediaGrid } from "./media-grid";
import { MediaListActions } from "./media-list-actions";

const MEDIA_ITEMS_PER_PAGE = 200;
const SCROLL_RESTORE_DELAY = 100;
const DEBOUNCE_DELAY_MS = 1000;

export function SourceMediaPage() {
	const params = useParams({ from: "/sources/$mediaSourceId/" });
	const queryClient = useQueryClient();

	const mediaSourceId = () => params().mediaSourceId;

	// Enable auto-save/restore of search conditions
	useCurrentSearchPersistence(mediaSourceId, PresetClient);

	// Fetch filter data
	const tags = createQuery(() => tagsQueryOptions());
	const allProjects = createQuery(() => allProjectsQueryOptions());
	const allIps = createQuery(() => allIpsQueryOptions());
	const allCharacters = createQuery(() => allCharactersQueryOptions());
	const allAuthors = createQuery(() => allAuthorsQueryOptions());

	// Optimize query key to only include relevant search parameters.
	// Serialize condition as JSON string to stabilize the key across mode toggles
	// (simple/pro produce structurally-equivalent but referentially-different objects).
	const searchConditionKey = createMemo(() =>
		JSON.stringify(getSearchCondition() ?? null),
	);

	const searchParams = createMemo(() => ({
		condition: getSearchCondition(),
		sort: searchState.sortBy,
		order: searchState.sortOrder,
	}));

	const mediaQuery = createInfiniteQuery(() => ({
		queryKey: [
			"media",
			mediaSourceId(),
			searchConditionKey(),
			searchState.sortBy,
			searchState.sortOrder,
		],
		queryFn: ({ pageParam }) => {
			const id = mediaSourceId();
			if (!id) {
				throw new Error("Media source ID is required");
			}
			return searchMedia(id, {
				...searchParams(),
				limit: MEDIA_ITEMS_PER_PAGE,
				offset: pageParam as number,
			});
		},
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) => {
			const loadedCount = allPages.reduce(
				(sum, page) => sum + page.media.length,
				0,
			);
			if (loadedCount < lastPage.total) {
				return loadedCount;
			}
			return;
		},
		placeholderData: keepPreviousData,
	}));

	const handleSearch = () => {
		window.scrollTo(0, 0);
	};

	// Disable browser's default scroll restoration
	onMount(() => {
		if (isServer) {
			return;
		}
		if ("scrollRestoration" in history) {
			history.scrollRestoration = "manual";
		}
	});

	// Scroll restoration logic - runs only once when data is first loaded
	const [isScrollRestored, setIsScrollRestored] = createSignal(false);

	createEffect(() => {
		if (isServer) {
			return;
		}
		if (isScrollRestored()) {
			return;
		}

		const id = mediaSourceId();
		if (!id) {
			return;
		}

		// Only restore scroll if we have data and it's not loading
		if (mediaQuery.data && !mediaQuery.isLoading) {
			const targetScrollY = getScrollPosition(id);

			if (targetScrollY > 0) {
				// Simple restoration attempt
				setTimeout(() => {
					requestAnimationFrame(() => {
						window.scrollTo(0, targetScrollY);
						setIsScrollRestored(true);
					});
				}, SCROLL_RESTORE_DELAY);
			} else {
				setIsScrollRestored(true);
			}
		}
	});

	onCleanup(() => {
		if (isServer) {
			return;
		}
		const id = mediaSourceId();
		if (id) {
			setScrollPosition(id, window.scrollY);
		}
	});

	// Infinite scroll trigger
	let loadMoreRef: HTMLDivElement | undefined;

	onMount(() => {
		if (isServer) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && mediaQuery.hasNextPage) {
					mediaQuery.fetchNextPage();
				}
			},
			{ threshold: 0.5, rootMargin: "1000px" },
		);

		if (loadMoreRef) {
			observer.observe(loadMoreRef);
		}

		onCleanup(() => observer.disconnect());
	});

	const [showUploadModal, setShowUploadModal] = createSignal(false);
	const [fileToUpload, setFileToUpload] = createSignal<File | null>(null);
	const [pastedUrl, setPastedUrl] = createSignal<string | null>(null);
	const [deleteDialogOpen, setDeleteDialogOpen] = createSignal(false);
	const [mediaIdToDelete, setMediaIdToDelete] = createSignal<string | null>(
		null,
	);

	// Copy/Move Dialog State
	const [moveCopyDialogOpen, setMoveCopyDialogOpen] = createSignal(false);
	const [moveCopyMode, setMoveCopyMode] = createSignal<"copy" | "move">("copy");
	const [mediaIdToMoveCopy, setMediaIdToMoveCopy] = createSignal<string | null>(
		null,
	);

	// Singleton Context Menu State
	const [contextMenuMediaId, setContextMenuMediaId] = createSignal<
		string | null
	>(null);

	let fileInputRef: HTMLInputElement | undefined;

	type UploadOptions = {
		file: File;
		filename: string;
		description: string;
		sourceUrl?: string;
		overwrite: boolean;
		autoIncrement: boolean;
	};

	const handleUpload = async (options: UploadOptions) => {
		await uploadMedia(mediaSourceId() || "", options.file, {
			filename: options.filename,
			description: options.description,
			sourceUrl: options.sourceUrl,
			overwrite: options.overwrite,
			autoIncrement: options.autoIncrement,
		});
		toast.success("Media uploaded successfully");
		// Invalidate query to refetch list
		queryClient.invalidateQueries({
			queryKey: ["media", mediaSourceId()],
		});
	};

	const handleFileSelect = async (e: Event) => {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			const file = target.files[0];

			// Check if it's a JSON file
			if (file.type === "application/json" || file.name.endsWith(".json")) {
				await handleJsonFileUpload(file);
			} else {
				// Normal image file upload
				setFileToUpload(file);
				setShowUploadModal(true);
			}

			// Reset file input
			target.value = "";
		}
	};

	const handleJsonFileUpload = async (file: File) => {
		try {
			const text = await file.text();
			const jsonContent = JSON.parse(text);
			let items: DownloadItem[] = [];

			// Case 1: JSON is a direct array of DownloadItem
			if (Array.isArray(jsonContent)) {
				items = jsonContent;
			}
			// Case 2: JSON is an object with an 'items' key (previous handling)
			else if (jsonContent.items && Array.isArray(jsonContent.items)) {
				items = jsonContent.items;
			}
			// Case 3: JSON is an object with an 'images' key (new handling for user's provided structure)
			else if (jsonContent.images && Array.isArray(jsonContent.images)) {
				items = jsonContent.images
					.map((image: any) => {
						const imageUrl = image.originalUrl || image.displayUrl;
						if (!imageUrl) {
							return null; // Skip if no valid URL is found
						}

						let tweetUrl: string | undefined;
						if (image.source === "twitter" && image.metadata?.postId) {
							tweetUrl = `https://twitter.com/i/web/status/${image.metadata.postId}`;
						}

						return {
							imageUrl,
							tweetUrl,
							tweetText: image.metadata?.title,
							authorName: image.metadata?.author,
							timestamp: image.metadata?.timestamp || image.date, // Assuming 'date' can be a fallback for timestamp
							// Add other fields as needed from the provided JSON structure to match DownloadItem
						};
					})
					.filter(Boolean) as DownloadItem[]; // Filter out nulls
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

			// Send to downloads API
			await startDownloadJobs(mediaSourceId() || "", items);

			toast.success("Bulk download started");
			// Refetch will happen via SSE events
		} catch (error) {
			logger.error({ err: error }, "Failed to process JSON upload");
			toast.error(`Failed to start download: ${(error as Error).message}`);
		}
	};

	const handleDumpDownload = async (mode: "json" | "zip" = "json") => {
		const id = mediaSourceId();
		if (!id) {
			return;
		}

		try {
			const blob = await fetchSourceDump(id, mode);
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `source-${id}-dump.${mode}`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);
			toast.success(`Dump (${mode.toUpperCase()}) downloaded successfully`);
		} catch (error) {
			logger.error(
				{ err: error, mediaSourceId: id, mode },
				"Failed to download dump",
			);
			toast.error("Failed to download dump");
		}
	};

	const handleRestoreSelect = async (e: Event) => {
		const target = e.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) {
			return;
		}

		const file = target.files[0];
		const id = mediaSourceId();
		if (!id) {
			return;
		}

		try {
			// Check for ZIP file
			if (
				file.name.endsWith(".zip") ||
				file.type === "application/zip" ||
				file.type === "application/x-zip-compressed"
			) {
				toast.loading("Importing ZIP dump...", { id: "restore-toast" });
				const result = await importSourceZip(id, file);
				toast.success(
					`Import complete: ${result.importedCount} items imported.`,
					{
						id: "restore-toast",
					},
				);
				queryClient.invalidateQueries({
					queryKey: ["media", id],
				});
				target.value = ""; // Reset input
				return;
			}

			// Default to JSON handling
			const reader = new FileReader();
			reader.onload = async (event) => {
				try {
					const json = JSON.parse(event.target?.result as string);

					toast.loading("Restoring metadata...", { id: "restore-toast" });

					const result = await restoreSource(id, json);

					toast.success(
						`Restore complete: ${result.processed} processed, ${result.skipped} skipped`,
						{ id: "restore-toast" },
					);

					// Refresh view
					queryClient.invalidateQueries({
						queryKey: ["media", id],
					});
				} catch (error) {
					logger.error({ err: error }, "Restore from JSON failed");
					toast.error(`Restore failed: ${(error as Error).message}`, {
						id: "restore-toast",
					});
				} finally {
					target.value = ""; // Reset input
				}
			};
			reader.readAsText(file);
		} catch (error) {
			logger.error({ err: error }, "Import failed");
			toast.error(`Import failed: ${(error as Error).message}`, {
				id: "restore-toast",
			});
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

			if (text && z.string().url().safeParse(text).success) {
				setPastedUrl(text);
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
		if (!e.clipboardData?.items) {
			return;
		}
		await processClipboardItems(e.clipboardData.items, e);
	};

	const handleDelete = (mediaId: string) => {
		setMediaIdToDelete(mediaId);
		setDeleteDialogOpen(true);
	};

	const _confirmDelete = async () => {
		const id = mediaIdToDelete();
		if (!id) {
			return;
		}

		try {
			await deleteMedia(mediaSourceId() || "", id);
			toast.success("Media deleted successfully");
			await mediaQuery.refetch();
		} catch (e) {
			logger.error({ err: e, mediaId: id }, "Failed to delete media");
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
		const id = mediaIdToMoveCopy();
		const sourceId = mediaSourceId();
		if (!(id && sourceId)) {
			return;
		}

		const mode = moveCopyMode();
		const action = mode === "copy" ? copyMedia : moveMedia;
		const actionName = mode === "copy" ? "copied" : "moved";

		try {
			await action(sourceId, id, targetSourceId);
			toast.success(`Media ${actionName} successfully`);
			await mediaQuery.refetch();
			// Invalidate target source cache to ensure fresh data when navigating
			if (sourceId !== targetSourceId) {
				await queryClient.invalidateQueries({
					queryKey: ["media", targetSourceId],
				});
			}
		} catch (e) {
			logger.error(
				{ err: e, mediaId: id, targetSourceId, mode },
				`Failed to ${mode} media`,
			);
			toast.error(`Failed to ${mode} media: ${(e as Error).message}`);
		} finally {
			setMediaIdToMoveCopy(null);
		}
	};

	const [isSyncingMedia, setIsSyncingMedia] = createSignal(false);

	const handleSyncLoadedMedia = async () => {
		const allPages = mediaQuery.data?.pages;
		if (!allPages) {
			return;
		}
		const mediaIds = allPages
			.flatMap((page) => page.media)
			.map((m) => m?.id)
			.filter(Boolean) as string[];

		if (mediaIds.length === 0 || isSyncingMedia()) {
			return;
		}

		setIsSyncingMedia(true);
		toast.info("Starting batch sync for loaded media...");
		try {
			await syncMediaItems(mediaSourceId() || "", mediaIds);
			toast.success(`Batch sync completed for ${mediaIds.length} items`);
			await mediaQuery.refetch();
		} catch (error) {
			logger.error({ err: error }, "Failed to batch sync media");
			toast.error(`Failed to batch sync: ${(error as Error).message}`);
		} finally {
			setIsSyncingMedia(false);
		}
	};

	const handleSyncSingleMedia = async (mediaId: string) => {
		toast.info("Starting metadata sync...");
		try {
			await syncMediaItems(mediaSourceId() || "", [mediaId]);
			toast.success("Metadata synced successfully");
			await mediaQuery.refetch();
		} catch (e) {
			logger.error({ err: e, mediaId }, "Failed to sync metadata");
			toast.error(`Failed to sync metadata: ${(e as Error).message}`);
		}
	};

	const [addedCount, setAddedCount] = createSignal(0);
	const [debounceTimer, setDebounceTimer] = createSignal<ReturnType<
		typeof setTimeout
	> | null>(null);

	onCleanup(() => {
		const timer = debounceTimer();
		if (timer) {
			clearTimeout(timer);
		}
	});

	useMediaSourceEvents(mediaSourceId, {
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
					queryClient.invalidateQueries({
						queryKey: ["media", mediaSourceId()],
					});
				}, DEBOUNCE_DELAY_MS),
			);
		},
		onMediaDeleted: () => {
			toast.success("Media deleted");
			queryClient.invalidateQueries({
				queryKey: ["media", mediaSourceId()],
			});
		},
		onThumbnailGenerated: () => {
			toast.success("Thumbnail generated");
			queryClient.invalidateQueries({
				queryKey: ["media", mediaSourceId()],
			});
		},
		onMediaCopied: () => {
			queryClient.invalidateQueries({
				queryKey: ["media", mediaSourceId()],
			});
		},
		onMediaMoved: () => {
			queryClient.invalidateQueries({
				queryKey: ["media", mediaSourceId()],
			});
		},
		onMediaChanged: () => {
			queryClient.invalidateQueries({
				queryKey: ["media", mediaSourceId()],
			});
		},
		onAllJobsCompleted: (data) => {
			toast.success(
				`All jobs completed! Processed: ${data.processed ?? "N/A"}`,
			);
			queryClient.invalidateQueries({
				queryKey: ["media", mediaSourceId()],
			});
		},
		onWatcherError: (data) => {
			toast.error(`Watcher Error: ${data.error || "Unknown error"}`);
		},
	});

	onMount(() => {
		if (!isServer) {
			document.addEventListener("paste", handlePaste);

			onCleanup(() => {
				document.removeEventListener("paste", handlePaste);
			});
		}
	});

	return (
		<section
			aria-label="Media upload area"
			class="container mx-auto min-h-[calc(100vh-2rem)] p-4"
			onDragOver={handleDragOver}
			onDrop={handleDrop}
		>
			<MediaListActions
				filterData={{
					tags: tags.data,
					projects: allProjects.data,
					ips: allIps.data,
					characters: allCharacters.data,
					authors: allAuthors.data,
				}}
				onDumpDownload={handleDumpDownload}
				onSearch={handleSearch}
			/>

			<div class="mb-4 flex items-center justify-between">
				<h1 class="font-bold text-2xl">Media in Source: {mediaSourceId()}</h1>
				<Button
					disabled={isSyncingMedia() || !mediaQuery.data?.pages.length}
					onClick={handleSyncLoadedMedia}
					variant="outline"
				>
					{isSyncingMedia() ? "Syncing..." : "Sync Loaded Media"}
				</Button>
			</div>

			<div class="grid gap-6 md:grid-cols-[300px_1fr]">
				{/* Sidebar Filters (Desktop only) */}
				<Card class="sticky top-20 hidden h-fit max-h-[calc(100vh-6rem)] overflow-y-auto md:block">
					<CardHeader>
						<CardTitle>検索フィルター</CardTitle>
					</CardHeader>
					<CardContent class="space-y-4">
						{/* Mode Switcher & Presets */}
						<SearchControlPanel
							class="w-full"
							context="source"
							filterData={{
								tags: tags.data,
								projects: allProjects.data,
								ips: allIps.data,
								characters: allCharacters.data,
								authors: allAuthors.data,
							}}
							onSearch={handleSearch}
							presetClient={PresetClient}
							usePopover={false}
						/>
					</CardContent>
				</Card>

				<MediaGrid
					contextMenuMediaId={contextMenuMediaId}
					isError={mediaQuery.isError}
					isFetchingNextPage={mediaQuery.isFetchingNextPage}
					isPending={mediaQuery.isPending}
					loadMoreRef={(el) => {
						loadMoreRef = el;
					}}
					mediaPages={() => mediaQuery.data?.pages}
					mediaSourceId={mediaSourceId}
					onCopyMove={handleCopyMove}
					onDelete={handleDelete}
					onSyncSingleMedia={handleSyncSingleMedia}
					queryError={mediaQuery.error ?? null}
					setContextMenuMediaId={setContextMenuMediaId}
				/>
			</div>

			{/* Hidden file input */}
			<input
				accept=".json,.zip"
				class="hidden"
				id="restore-input"
				onChange={handleRestoreSelect}
				type="file"
			/>
			<input
				accept="image/*,.json"
				class="hidden"
				onChange={handleFileSelect}
				ref={(el) => {
					fileInputRef = el;
				}}
				type="file"
			/>

			{/* Floating add button */}
			<button
				aria-label="Add media"
				class="fixed right-8 bottom-8 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl"
				onClick={handleAddButtonClick}
				type="button"
			>
				<span class="text-3xl leading-none">＋</span>
			</button>

			<UploadMediaModal
				initialFile={fileToUpload()}
				isOpen={showUploadModal()}
				onClose={() => {
					setShowUploadModal(false);
					setPastedUrl(null);
					setFileToUpload(null);
				}}
				onUpload={handleUpload}
				onUrlFetch={(file) => setFileToUpload(file)}
				pastedUrl={pastedUrl()}
			/>
			<Dialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen()}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Media</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this media? This action cannot be
							undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							onClick={() => setDeleteDialogOpen(false)}
							variant="outline"
						>
							Cancel
						</Button>
						<Button onClick={_confirmDelete} variant="destructive">
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<MoveCopyMediaDialog
				currentSourceId={mediaSourceId() || ""}
				mode={moveCopyMode()}
				onConfirm={handleConfirmCopyMove}
				onOpenChange={setMoveCopyDialogOpen}
				open={moveCopyDialogOpen()}
			/>
		</section>
	);
}
