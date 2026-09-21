import type { Media } from "@solid-imager/core/domain/media/schemas";
import { getErrorMessage } from "@solid-imager/core/utils";
import { BulkActionDialog } from "@solid-imager/ui/bulk-action-dialog";
import { Button } from "@solid-imager/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@solid-imager/ui/dialog";
import { persistSearchScrollPosition } from "@solid-imager/ui/hooks/use-current-search-persistence";
import {
	type MediaCollectionSelectionMode,
	useMediaCollectionSelection,
} from "@solid-imager/ui/hooks/use-media-collection-selection";
import { useSearchHistoryPersistence } from "@solid-imager/ui/hooks/use-search-history-persistence";
import { useSearchPage } from "@solid-imager/ui/hooks/use-search-page";
import { saveMediaContext } from "@solid-imager/ui/media-context";
import { createPresetClient } from "@solid-imager/ui/preset-client";
import { SearchScreen } from "@solid-imager/ui/screens/search-screen";
import { createSearchHistoryClient } from "@solid-imager/ui/search-history-client";
import { searchHistoryQuerySchema } from "@solid-imager/ui/search-history-route";
import { activateSimilaritySearch } from "@solid-imager/ui/stores/search-store";
import { toast } from "@solid-imager/ui/toast";
import {
	createFileRoute,
	useLocation,
	useNavigate,
	useRouter,
} from "@tanstack/solid-router";
import { createSignal } from "solid-js";
import { MediaGridItem } from "~/components/media/media-grid-item";
import { MoveCopyMediaDialog } from "~/components/media/move-copy-media-dialog";
import { ThumbnailImage } from "~/components/media/thumbnail-image";
import { useMediaSourceEvents } from "~/hooks/use-media-source-events";
import { PresetClient as rawPresetClient } from "~/infrastructure/api/clients/preset-client";
import { SearchHistoryClient as rawSearchHistoryClient } from "~/infrastructure/api/clients/search-history-client";
import {
	bulkCopyToSource,
	bulkDeleteMedia,
	bulkMoveMedia,
	bulkMoveToSource,
	copyMedia,
	deleteMedia,
	moveMedia,
} from "~/infrastructure/api-clients/media-api";
import {
	searchMedia,
	searchSimilar,
} from "~/infrastructure/api-clients/search-api";
import { fetchMediaSources } from "~/infrastructure/api-clients/sources-api";
import {
	getSearchCondition,
	searchState,
	setSearchState,
} from "~/presentation/store/search-store";
import {
	allAuthorsQueryOptions,
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	mediaSourcesQueryOptions,
	tagsQueryOptions,
} from "~/queries";

export const Route = createFileRoute("/search")({
	validateSearch: searchHistoryQuerySchema,
	loader: ({ context }) => {
		void context.queryClient.prefetchQuery(tagsQueryOptions());
		void context.queryClient.prefetchQuery(mediaSourcesQueryOptions());
		void context.queryClient.prefetchQuery(allProjectsQueryOptions());
		void context.queryClient.prefetchQuery(allIpsQueryOptions());
		void context.queryClient.prefetchQuery(allCharactersQueryOptions());
		void context.queryClient.prefetchQuery(allAuthorsQueryOptions());
	},
	component: SearchRoute,
});

const SEARCH_RESULTS_REFRESH_DEBOUNCE_MS = 300;
const SEARCH_RESULTS_PER_PAGE = 200;
const presetClient = createPresetClient(rawPresetClient);
const searchHistoryClient = createSearchHistoryClient(rawSearchHistoryClient);

function SearchRoute() {
	const location = useLocation();
	const navigate = useNavigate();
	const router = useRouter();
	const [visibleMediaIds, setVisibleMediaIds] = createSignal<readonly string[]>(
		[],
	);
	const selection = useMediaCollectionSelection(visibleMediaIds);
	const [isBulkSelectMode, setIsBulkSelectMode] = createSignal(false);
	const [isBulkActionOpen, setIsBulkActionOpen] = createSignal(false);
	const [deleteTarget, setDeleteTarget] = createSignal<Media | null>(null);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = createSignal(false);
	const [isDeleteSubmitting, setIsDeleteSubmitting] = createSignal(false);
	const [moveCopyTarget, setMoveCopyTarget] = createSignal<Media | null>(null);
	const [moveCopyMode, setMoveCopyMode] = createSignal<"copy" | "move">("copy");
	const [isMoveCopyDialogOpen, setIsMoveCopyDialogOpen] = createSignal(false);
	const searchHistory = useSearchHistoryPersistence("all", {
		client: searchHistoryClient,
	});
	const page = useSearchPage({
		searchMedia,
		searchSimilar,
		queries: {
			tags: tagsQueryOptions,
			sources: mediaSourcesQueryOptions,
			projects: allProjectsQueryOptions,
			ips: allIpsQueryOptions,
			characters: allCharactersQueryOptions,
			authors: allAuthorsQueryOptions,
		},
		selectedSource: () => searchState.selectedSource,
		getSearchCondition,
		sortBy: () => searchState.sortBy,
		sortOrder: () => searchState.sortOrder,
		limit: () => Math.max(searchState.limit, SEARCH_RESULTS_PER_PAGE),
		scrollY: () => searchState.scrollY,
		setScrollY: (value) => {
			setSearchState("scrollY", value);
			persistSearchScrollPosition("all", value, {
				historyEntryKey: searchHistory.historyEntryKey,
			});
		},
		setOffset: (value) => setSearchState("offset", value),
		mode: () => searchState.mode,
		similarityAnchorMediaId: () => searchState.similarityAnchorMediaId,
		similarityTopK: () => searchState.similarityTopK,
		refreshDebounceMs: SEARCH_RESULTS_REFRESH_DEBOUNCE_MS,
		isSearchStateRestored: searchHistory.isRestored,
		commitSearchHistory: searchHistory.commitNow,
		historyEntryKey: searchHistory.historyEntryKey,
		enableVirtualization: true,
		scrollContainerSelector: '[data-media-scroll="search"]',
	});

	const currentReturnPath = () => {
		const current = location();
		return `${current.pathname}${current.searchStr}${current.hash}`;
	};
	const rememberMediaReturn = (media: Media, context?: Media[]) => {
		const returnPath = currentReturnPath();
		saveMediaContext(returnPath, context ?? [media]);
	};
	const findSearchMedia = (mediaId: string) =>
		page.searchResults().find((media) => media.id === mediaId);
	const clearSelection = () => {
		setIsBulkSelectMode(false);
		selection.clear();
	};
	const handleSelection = (
		mediaId: string,
		mode: MediaCollectionSelectionMode,
	) => {
		setIsBulkSelectMode(true);
		selection.select(mediaId, mode);
	};
	const forgetSelectedMedia = (mediaId: string) => {
		if (selection.isSelected(mediaId)) selection.select(mediaId, "toggle");
		if (selection.selectedIds().size === 0) setIsBulkSelectMode(false);
	};
	const handleDelete = (mediaId: string) => {
		const media = findSearchMedia(mediaId);
		if (!media) return;
		setDeleteTarget(media);
		setIsDeleteSubmitting(false);
		setIsDeleteDialogOpen(true);
	};
	const handleCopyMove = (mediaId: string, mode: "copy" | "move") => {
		const media = findSearchMedia(mediaId);
		if (!media) return;
		setMoveCopyTarget(media);
		setMoveCopyMode(mode);
		setIsMoveCopyDialogOpen(true);
	};
	const confirmDelete = async () => {
		const media = deleteTarget();
		if (!media || isDeleteSubmitting()) return;
		setIsDeleteSubmitting(true);
		try {
			await deleteMedia(media.mediaSourceId, media.id);
			forgetSelectedMedia(media.id);
			toast.success("Media deleted");
			page.refreshSearchResults();
		} catch (error) {
			toast.error(`Failed to delete media: ${getErrorMessage(error)}`);
		} finally {
			setIsDeleteSubmitting(false);
			setIsDeleteDialogOpen(false);
			setDeleteTarget(null);
		}
	};
	const handleConfirmCopyMove = async (targetSourceId: string) => {
		const media = moveCopyTarget();
		if (!media) return;
		const mode = moveCopyMode();
		try {
			if (mode === "copy") {
				await copyMedia(media.id, targetSourceId);
			} else {
				await moveMedia(media.id, targetSourceId);
			}
			toast.success(`Media ${mode === "copy" ? "copied" : "moved"}`);
			page.refreshSearchResults();
		} catch (error) {
			toast.error(`Failed to ${mode} media: ${getErrorMessage(error)}`);
		} finally {
			setMoveCopyTarget(null);
			setIsMoveCopyDialogOpen(false);
		}
	};
	const selectedMediaItems = () =>
		page
			.searchResults()
			.filter((media) => selection.isSelected(media.id))
			.map((media) => ({
				mediaId: media.id,
				mediaSourceId: media.mediaSourceId,
			}));

	useMediaSourceEvents(() => searchState.selectedSource || "*", {
		onMediaAdded: page.refreshSearchResults,
		onMediaDeleted: page.refreshSearchResults,
		onMediaChanged: page.refreshSearchResults,
		onMediaCopied: page.refreshSearchResults,
		onMediaMoved: page.refreshSearchResults,
		onAllJobsCompleted: page.refreshSearchResults,
	});

	return (
		<>
			<SearchScreen
				enableVirtualization
				filterData={page.filterData}
				page={page}
				presetClient={presetClient}
				detailBasePath={router.history.createHref("/sources")}
				isBulkSelectMode={isBulkSelectMode}
				isSelected={selection.isSelected}
				onBulkAction={() => setIsBulkActionOpen(true)}
				onClearSelection={clearSelection}
				onCopyMove={handleCopyMove}
				onDelete={handleDelete}
				onFindSimilar={(media) => activateSimilaritySearch(media.id)}
				onSelectAll={() => {
					setIsBulkSelectMode(true);
					selection.selectAll();
				}}
				onSelectMedia={handleSelection}
				onSelectSource={(id) => setSearchState("selectedSource", id)}
				onToggleSelect={(mediaId) => handleSelection(mediaId, "toggle")}
				onVisibleMediaIdsChange={setVisibleMediaIds}
				onPrepareMediaDetail={(media, context) =>
					rememberMediaReturn(media, context)
				}
				onOpenMediaDetail={(media, context) => {
					rememberMediaReturn(media, context);
					void navigate({
						params: {
							mediaId: media.id,
							mediaSourceId: media.mediaSourceId,
						},
						to: "/sources/$mediaSourceId/$mediaId",
					});
				}}
				renderMediaItem={(media, options) => (
					<MediaGridItem
						imageLoadPolicy={options?.imageLoadPolicy}
						isBulkSelectMode={options?.isBulkSelectMode}
						isSelected={options?.isSelected}
						isPreviewSelected={options?.isPreviewSelected}
						media={media}
						onContextMenu={options?.onContextMenu}
						onOpenMediaDetail={options?.onOpenMediaDetail}
						onPrepareMediaDetail={options?.onPrepareMediaDetail}
						onPreviewSelect={options?.onPreviewSelect}
						onSelectGesture={options?.onSelectGesture}
						onToggleSelect={options?.onToggleSelect}
						priority={options?.priority}
						sourceRootPath={page.getSourceRootPath(media.mediaSourceId)}
					/>
				)}
				renderMediaPreview={(media) => (
					<ThumbnailImage
						alt={media.fileName}
						class="h-full w-full object-contain"
						height={media.height}
						loading="eager"
						media={media}
						requestedSize={512}
						width={media.width}
					/>
				)}
				selectedCount={() => selection.selectedIds().size}
				selectedSource={searchState.selectedSource}
				sources={page.sources()}
				ssrGuard
			/>
			<Dialog
				onOpenChange={(open) => {
					setIsDeleteDialogOpen(open);
					if (!open && !isDeleteSubmitting()) setDeleteTarget(null);
				}}
				open={isDeleteDialogOpen()}
			>
				<DialogContent class="workspace-theme">
					<DialogHeader>
						<DialogTitle>メディアを削除</DialogTitle>
						<DialogDescription>
							この操作は取り消せません。
							{deleteTarget()?.fileName ?? "選択したメディア"}を削除しますか？
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							disabled={isDeleteSubmitting()}
							onClick={() => setIsDeleteDialogOpen(false)}
							variant="outline"
						>
							キャンセル
						</Button>
						<Button
							disabled={isDeleteSubmitting()}
							onClick={confirmDelete}
							variant="destructive"
						>
							{isDeleteSubmitting() ? "削除中..." : "削除"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<MoveCopyMediaDialog
				currentSourceId={moveCopyTarget()?.mediaSourceId ?? ""}
				mode={moveCopyMode()}
				onConfirm={handleConfirmCopyMove}
				onOpenChange={(open) => {
					setIsMoveCopyDialogOpen(open);
					if (!open) setMoveCopyTarget(null);
				}}
				open={isMoveCopyDialogOpen()}
			/>
			<BulkActionDialog
				bulkCopyToSource={bulkCopyToSource}
				bulkDeleteMedia={bulkDeleteMedia}
				bulkMoveMedia={bulkMoveMedia}
				bulkMoveToSource={bulkMoveToSource}
				listSources={fetchMediaSources}
				mediaIds={selectedMediaItems().map((item) => item.mediaId)}
				mediaItems={selectedMediaItems()}
				onOpenChange={setIsBulkActionOpen}
				onSuccess={(partial) => {
					if (!partial) clearSelection();
					page.refreshSearchResults();
				}}
				open={isBulkActionOpen()}
			/>
		</>
	);
}
