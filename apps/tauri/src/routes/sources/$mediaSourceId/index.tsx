import type {
	DownloadItem,
	MediaSearchResponse,
} from "@solid-imager/core/domain/media/schemas";
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
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@solid-imager/ui/context-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@solid-imager/ui/dialog";
import { toast } from "@solid-imager/ui/toast";
import {
	createInfiniteQuery,
	createQuery,
	keepPreviousData,
	useQueryClient,
} from "@tanstack/solid-query";
import { createFileRoute, useParams } from "@tanstack/solid-router";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { z } from "zod";
import { MediaGridItem } from "../../../components/media/media-grid-item";
import { MoveCopyMediaDialog } from "../../../components/media/move-copy-media-dialog";
import { SearchControlPanel } from "../../../components/media/search-control-panel";
import { UploadMediaModal } from "../../../components/upload-media-modal";
import { useCurrentSearchPersistence } from "../../../hooks/use-current-search-persistence";
import { useMediaSourceEvents } from "../../../hooks/use-media-source-events";
import {
	copyMedia,
	deleteMedia,
	moveMedia,
	startDownloadJobs,
	syncMediaItems,
	uploadMedia,
} from "../../../infrastructure/api-clients/media-api";
import { allAuthorsQueryOptions } from "../../../infrastructure/api-clients/queries/authors-query";
import { allCharactersQueryOptions } from "../../../infrastructure/api-clients/queries/characters-query";
import { allIpsQueryOptions } from "../../../infrastructure/api-clients/queries/ips-query";
import { allProjectsQueryOptions } from "../../../infrastructure/api-clients/queries/projects-query";
import { mediaSourcesQueryOptions } from "../../../infrastructure/api-clients/queries/sources-query";
import { tagsQueryOptions } from "../../../infrastructure/api-clients/queries/tags-query";
import { searchMedia } from "../../../infrastructure/api-clients/search-api";
import {
	fetchSourceDump,
	importSourceZip,
	restoreSource,
} from "../../../infrastructure/api-clients/sources-api";
import {
	getSearchCondition,
	searchState,
} from "../../../presentation/store/search-store";

export const Route = createFileRoute("/sources/$mediaSourceId/")({
	loader: async ({ context }) => {
		await Promise.all([
			context.queryClient.ensureQueryData(tagsQueryOptions()),
			context.queryClient.ensureQueryData(allProjectsQueryOptions()),
			context.queryClient.ensureQueryData(allIpsQueryOptions()),
			context.queryClient.ensureQueryData(allCharactersQueryOptions()),
			context.queryClient.ensureQueryData(allAuthorsQueryOptions()),
			context.queryClient.ensureQueryData(mediaSourcesQueryOptions()),
		]);
	},
	component: SourceMediaRoute,
});

function SourceMediaRoute() {
	const params = useParams({ from: "/sources/$mediaSourceId/" });
	const mediaSourceId = () => params().mediaSourceId;
	const queryClient = useQueryClient();

	useCurrentSearchPersistence(mediaSourceId);

	const tags = createQuery(() => tagsQueryOptions());
	const allProjects = createQuery(() => allProjectsQueryOptions());
	const allIps = createQuery(() => allIpsQueryOptions());
	const allCharacters = createQuery(() => allCharactersQueryOptions());
	const allAuthors = createQuery(() => allAuthorsQueryOptions());
	const sources = createQuery(() => mediaSourcesQueryOptions());

	const source = createMemo(() =>
		sources.data?.find((item) => item.id === mediaSourceId()),
	);
	const sourceRootPath = createMemo(() => {
		const current = source();
		if (current?.type !== "local") {
			return undefined;
		}
		const connectionInfo = current.connectionInfo as { path?: string };
		return connectionInfo.path;
	});

	const searchConditionKey = createMemo(() =>
		JSON.stringify(getSearchCondition() ?? null),
	);

	const mediaQuery = createInfiniteQuery<MediaSearchResponse>(() => ({
		queryKey: [
			"media",
			mediaSourceId(),
			searchConditionKey(),
			searchState.sortBy,
			searchState.sortOrder,
		],
		queryFn: ({ pageParam }) =>
			searchMedia(mediaSourceId(), {
				condition: getSearchCondition() || undefined,
				sort: searchState.sortBy,
				order: searchState.sortOrder,
				limit: 100,
				offset: Number(pageParam ?? 0),
			}),
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

	useMediaSourceEvents(mediaSourceId, {
		onMediaAdded: () => {
			void mediaQuery.refetch();
		},
		onMediaDeleted: () => {
			void mediaQuery.refetch();
		},
		onMediaChanged: () => {
			void mediaQuery.refetch();
		},
	});

	const mediaResults = createMemo(() => {
		const seen = new Set<string>();
		return (mediaQuery.data?.pages.flatMap((page) => page.media) || []).filter(
			(media) => {
				if (seen.has(media.id)) {
					return false;
				}
				seen.add(media.id);
				return true;
			},
		);
	});

	const handleSearch = () => {
		window.scrollTo(0, 0);
	};

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
	const [isScrollRestored, setIsScrollRestored] = createSignal(false);

	let fileInputRef: HTMLInputElement | undefined;

	type UploadOptions = {
		file: File;
		filename: string;
		description: string;
		sourceUrl?: string;
		overwrite: boolean;
		autoIncrement: boolean;
	};

	const invalidateMediaQueries = async () => {
		await Promise.all([
			mediaQuery.refetch(),
			queryClient.invalidateQueries({
				queryKey: ["media", mediaSourceId()],
			}),
		]);
	};

	const handleUpload = async (options: UploadOptions) => {
		await uploadMedia(mediaSourceId(), options.file, options);
		toast.success("Media uploaded successfully");
		await invalidateMediaQueries();
	};

	const handleFileSelect = async (event: Event) => {
		const target = event.target as HTMLInputElement;
		if (!target.files?.length) {
			return;
		}
		const file = target.files[0];
		if (file.type === "application/json" || file.name.endsWith(".json")) {
			await handleJsonFileUpload(file);
		} else {
			setFileToUpload(file);
			setShowUploadModal(true);
		}
		target.value = "";
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
				items = jsonContent.images
					.map((image: Record<string, unknown>) => {
						const imageUrl =
							(typeof image.originalUrl === "string" && image.originalUrl) ||
							(typeof image.displayUrl === "string" && image.displayUrl);
						if (!imageUrl) {
							return null;
						}
						return {
							targetUrl: imageUrl,
							description:
								typeof image.title === "string" ? image.title : undefined,
						};
					})
					.filter(Boolean) as DownloadItem[];
			} else {
				throw new Error("Unsupported JSON structure.");
			}

			if (items.length === 0) {
				throw new Error("No downloadable items were found in the JSON file.");
			}

			await startDownloadJobs(mediaSourceId(), items);
			toast.success("Download jobs queued to inbox");
		} catch (error) {
			toast.error(`Failed to queue downloads: ${(error as Error).message}`);
		}
	};

	const handleDumpDownload = async () => {
		try {
			const blob = await fetchSourceDump(mediaSourceId(), "json");
			const url = window.URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `source-${mediaSourceId()}-dump.json`;
			document.body.append(anchor);
			anchor.click();
			document.body.removeChild(anchor);
			window.URL.revokeObjectURL(url);
			toast.success("Dump JSON downloaded successfully");
		} catch (error) {
			toast.error(`Failed to download dump: ${(error as Error).message}`);
		}
	};

	const handleZipDumpDownload = async () => {
		try {
			await fetchSourceDump(mediaSourceId(), "zip");
		} catch (error) {
			toast.error((error as Error).message);
		}
	};

	const handleRestoreSelect = async (event: Event) => {
		const target = event.target as HTMLInputElement;
		if (!target.files?.length) {
			return;
		}
		const file = target.files[0];
		try {
			if (
				file.name.endsWith(".zip") ||
				file.type === "application/zip" ||
				file.type === "application/x-zip-compressed"
			) {
				await importSourceZip(mediaSourceId(), file);
				await invalidateMediaQueries();
				toast.success("ZIP restore completed");
				return;
			}
			const data = JSON.parse(await file.text());
			await restoreSource(mediaSourceId(), data);
			await invalidateMediaQueries();
			toast.success("Restore completed");
		} catch (error) {
			toast.error(`Restore failed: ${(error as Error).message}`);
		} finally {
			target.value = "";
		}
	};

	const handleDrop = (event: DragEvent) => {
		event.preventDefault();
		event.stopPropagation();
		const file = event.dataTransfer?.files?.[0];
		if (!file) {
			return;
		}
		if (file.type === "application/json" || file.name.endsWith(".json")) {
			void handleJsonFileUpload(file);
			return;
		}
		setFileToUpload(file);
		setShowUploadModal(true);
	};

	const handleDragOver = (event: DragEvent) => {
		event.preventDefault();
		event.stopPropagation();
	};

	const handleImagePasteItem = (
		item: DataTransferItem,
		event: ClipboardEvent,
	): boolean => {
		if (!item.type.startsWith("image/")) {
			return false;
		}

		const blob = item.getAsFile();
		if (!blob) {
			return false;
		}

		const file = new File([blob], `pasted-image-${Date.now()}.png`, {
			type: blob.type,
		});
		setFileToUpload(file);
		setShowUploadModal(true);
		event.preventDefault();
		return true;
	};

	const handleUrlPasteItem = async (
		item: DataTransferItem,
		event: ClipboardEvent,
	): Promise<boolean> => {
		if (item.type !== "text/plain") {
			return false;
		}

		const text = await new Promise<string | null>((resolve) => {
			item.getAsString((value) => resolve(value));
		});

		if (!(text && z.string().url().safeParse(text).success)) {
			return false;
		}

		setPastedUrl(text);
		setShowUploadModal(true);
		event.preventDefault();
		return true;
	};

	const processClipboardItems = async (
		items: DataTransferItemList,
		event: ClipboardEvent,
	): Promise<boolean> => {
		for (const item of items) {
			if (handleImagePasteItem(item, event)) {
				return true;
			}
		}

		for (const item of items) {
			if (await handleUrlPasteItem(item, event)) {
				return true;
			}
		}

		return false;
	};

	const handlePaste = async (event: ClipboardEvent) => {
		if (!event.clipboardData?.items) {
			return;
		}
		await processClipboardItems(event.clipboardData.items, event);
	};

	const handleDelete = (mediaId: string) => {
		setMediaIdToDelete(mediaId);
		setDeleteDialogOpen(true);
	};

	const confirmDelete = async () => {
		const id = mediaIdToDelete();
		if (!id) {
			return;
		}
		try {
			await deleteMedia(mediaSourceId(), id);
			toast.success("Media deleted successfully");
			await invalidateMediaQueries();
		} catch (error) {
			toast.error(`Failed to delete media: ${(error as Error).message}`);
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
		if (!id) {
			return;
		}
		const action = moveCopyMode() === "copy" ? copyMedia : moveMedia;
		try {
			await action(mediaSourceId(), id, targetSourceId);
			toast.success(
				`Media ${moveCopyMode() === "copy" ? "copied" : "moved"} successfully`,
			);
			await invalidateMediaQueries();
		} catch (error) {
			toast.error(
				`Failed to ${moveCopyMode()} media: ${(error as Error).message}`,
			);
		} finally {
			setMediaIdToMoveCopy(null);
		}
	};

	const handleSyncLoadedMedia = async () => {
		const allPages = mediaQuery.data?.pages;
		if (!allPages || isSyncingMedia()) {
			return;
		}
		const mediaIds = allPages
			.flatMap((page) => page.media)
			.map((media) => media.id);
		if (!mediaIds.length) {
			return;
		}
		setIsSyncingMedia(true);
		try {
			await syncMediaItems(mediaSourceId(), mediaIds);
			toast.success(`Synced ${mediaIds.length} media items`);
			await invalidateMediaQueries();
		} catch (error) {
			toast.error(`Failed to sync media: ${(error as Error).message}`);
		} finally {
			setIsSyncingMedia(false);
		}
	};

	const handleSyncSingleMedia = async (mediaId: string) => {
		try {
			await syncMediaItems(mediaSourceId(), [mediaId]);
			toast.success("Metadata sync completed");
			await invalidateMediaQueries();
		} catch (error) {
			toast.error(`Failed to sync media: ${(error as Error).message}`);
		}
	};

	const [loadMoreRef, setLoadMoreRef] = createSignal<
		HTMLDivElement | undefined
	>(undefined);

	createEffect(() => {
		const element = loadMoreRef();
		if (!element) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && mediaQuery.hasNextPage) {
					void mediaQuery.fetchNextPage();
				}
			},
			{ threshold: 0.5, rootMargin: "1000px" },
		);

		observer.observe(element);
		onCleanup(() => observer.disconnect());
	});

	onMount(() => {
		if ("scrollRestoration" in history) {
			history.scrollRestoration = "manual";
		}

		document.addEventListener("paste", handlePaste);
		onCleanup(() => {
			document.removeEventListener("paste", handlePaste);
		});
	});

	createEffect(() => {
		if (isScrollRestored()) {
			return;
		}

		const id = mediaSourceId();
		if (!(id && mediaQuery.data && !mediaQuery.isLoading)) {
			return;
		}

		const targetScrollY = getScrollPosition(id);
		if (targetScrollY > 0) {
			setTimeout(() => {
				requestAnimationFrame(() => {
					window.scrollTo(0, targetScrollY);
					setIsScrollRestored(true);
				});
			}, 100);
			return;
		}

		setIsScrollRestored(true);
	});

	onCleanup(() => {
		const id = mediaSourceId();
		if (id) {
			setScrollPosition(id, window.scrollY);
		}
	});

	const panel = (
		<SearchControlPanel
			context="source"
			filterData={{
				tags: tags.data,
				projects: allProjects.data,
				ips: allIps.data,
				characters: allCharacters.data,
				authors: allAuthors.data,
			}}
			onSearch={handleSearch}
		/>
	);

	return (
		<main
			class="container mx-auto p-4"
			onDragOver={handleDragOver}
			onDrop={handleDrop}
		>
			<div class="mb-8 flex items-center justify-between">
				<div>
					<h1 class="mb-2 font-bold text-3xl">
						{source()?.name ?? "Media Source"}
					</h1>
					<p class="text-gray-600">{source()?.description}</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<Button onClick={() => fileInputRef?.click()}>Add Media</Button>
					<Button onClick={handleDumpDownload} variant="outline">
						Dump JSON
					</Button>
					<Button onClick={handleZipDumpDownload} variant="outline">
						Dump ZIP
					</Button>
					<Button
						onClick={() => document.getElementById("restore-input")?.click()}
						variant="outline"
					>
						Restore
					</Button>
					<Button
						disabled={isSyncingMedia() || !mediaQuery.data?.pages.length}
						onClick={handleSyncLoadedMedia}
						variant="outline"
					>
						{isSyncingMedia() ? "Syncing..." : "Sync Loaded Media"}
					</Button>
					<div class="md:hidden">
						<Dialog>
							<DialogTrigger as={Button} variant="outline">
								Filters
							</DialogTrigger>
							<DialogContent class="max-h-[80vh] overflow-y-auto">
								<DialogHeader>
									<DialogTitle>検索フィルター</DialogTitle>
								</DialogHeader>
								<div class="space-y-4">{panel}</div>
							</DialogContent>
						</Dialog>
					</div>
				</div>
			</div>

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
				ref={(element) => {
					fileInputRef = element;
				}}
				type="file"
			/>

			<div class="grid gap-6 md:grid-cols-[300px_1fr]">
				<Card class="sticky top-20 hidden h-fit max-h-[calc(100vh-6rem)] overflow-y-auto md:block">
					<CardHeader>
						<CardTitle>検索フィルター</CardTitle>
					</CardHeader>
					<CardContent class="space-y-4">{panel}</CardContent>
				</Card>

				<div class="space-y-4">
					<div class="mb-4 flex items-center justify-between">
						<p class="text-gray-600 text-sm">
							{mediaQuery.data?.pages[0]?.total ?? 0} 件の結果
						</p>
					</div>

					<ContextMenu>
						<ContextMenuTrigger class="h-full w-full">
							<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
								<For each={mediaResults()}>
									{(media) => (
										<MediaGridItem
											media={media}
											onContextMenu={() => setContextMenuMediaId(media.id)}
											sourceRootPath={sourceRootPath()}
										/>
									)}
								</For>
							</div>
						</ContextMenuTrigger>
						<ContextMenuContent>
							<Show
								fallback={
									<ContextMenuItem disabled>No media selected</ContextMenuItem>
								}
								when={contextMenuMediaId()}
							>
								<ContextMenuItem
									onSelect={() => {
										const id = contextMenuMediaId();
										if (id) {
											handleDelete(id);
										}
									}}
								>
									Delete
								</ContextMenuItem>
								<ContextMenuSeparator />
								<ContextMenuItem
									onSelect={() => {
										const id = contextMenuMediaId();
										if (id) {
											handleCopyMove(id, "copy");
										}
									}}
								>
									Copy to Source
								</ContextMenuItem>
								<ContextMenuItem
									onSelect={() => {
										const id = contextMenuMediaId();
										if (id) {
											handleCopyMove(id, "move");
										}
									}}
								>
									Move to Source
								</ContextMenuItem>
								<ContextMenuSeparator />
								<ContextMenuItem
									onSelect={() => {
										const id = contextMenuMediaId();
										if (id) {
											void handleSyncSingleMedia(id);
										}
									}}
								>
									Sync Metadata
								</ContextMenuItem>
							</Show>
						</ContextMenuContent>
					</ContextMenu>

					<Show when={mediaResults().length === 0 && !mediaQuery.isLoading}>
						<div class="py-12 text-center text-gray-500">
							検索結果が見つかりませんでした
						</div>
					</Show>

					<div ref={setLoadMoreRef} />
				</div>
			</div>

			<UploadMediaModal
				initialFile={fileToUpload()}
				isOpen={showUploadModal()}
				onClose={() => {
					setShowUploadModal(false);
					setFileToUpload(null);
					setPastedUrl(null);
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
						<Button onClick={confirmDelete} variant="destructive">
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<MoveCopyMediaDialog
				currentSourceId={mediaSourceId()}
				mode={moveCopyMode()}
				onConfirm={handleConfirmCopyMove}
				onOpenChange={setMoveCopyDialogOpen}
				open={moveCopyDialogOpen()}
			/>
		</main>
	);
}
