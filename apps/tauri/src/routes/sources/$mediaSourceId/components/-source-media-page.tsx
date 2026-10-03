import type { Media } from "@solid-imager/core/domain/media/schemas";
import { BulkActionDialog } from "@solid-imager/ui/bulk-action-dialog";
import {
	type MediaCollectionSelectionMode,
	useMediaCollectionSelection,
} from "@solid-imager/ui/hooks/use-media-collection-selection";
import { useSourceRootPath } from "@solid-imager/ui/hooks/use-source-root-path";
import { saveMediaContext } from "@solid-imager/ui/media-context";
import { createPresetClient } from "@solid-imager/ui/preset-client";
import { createSearchHistoryClient } from "@solid-imager/ui/search-history-client";
import { SourceMediaPage as SourceMediaPageComponent } from "@solid-imager/ui/source-media-page";
import { activateSimilaritySearch } from "@solid-imager/ui/stores/search-store";
import { createQuery } from "@tanstack/solid-query";
import {
	useLocation,
	useNavigate,
	useParams,
	useRouter,
} from "@tanstack/solid-router";
import { createSignal } from "solid-js";
import { MediaGridItem } from "~/components/media/media-grid-item";
import { MoveCopyMediaDialog } from "~/components/media/move-copy-media-dialog";
import { UploadMediaModal } from "~/components/upload-media-modal";
import { createTauriTransport } from "~/hooks/use-media-source-events";
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
	startDownloadJobs,
	syncMediaItems,
	uploadMedia,
} from "~/infrastructure/api-clients/media-api";
import { searchMedia } from "~/infrastructure/api-clients/search-api";
import { fetchMediaSources } from "~/infrastructure/api-clients/sources-api";
import { notifyThumbnailReady } from "~/infrastructure/media/thumbnail-runtime";
import {
	getSearchCondition,
	searchState,
} from "~/presentation/store/search-store";
import {
	allAuthorsQueryOptions,
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	mediaSourcesQueryOptions,
	tagsQueryOptions,
} from "~/queries";

const presetClient = createPresetClient(rawPresetClient);
const searchHistoryClient = createSearchHistoryClient(rawSearchHistoryClient);

export function SourceMediaPage() {
	const params = useParams({ from: "/sources/$mediaSourceId/" });
	const location = useLocation();
	const navigate = useNavigate();
	const router = useRouter();
	const mediaSourceId = () => params().mediaSourceId;
	const mediaSources = createQuery(() => mediaSourcesQueryOptions());
	const mediaSourceName = () =>
		mediaSources.data?.find((source) => source.id === mediaSourceId())?.name;
	const sourceRootPathResolver = useSourceRootPath(mediaSourcesQueryOptions);
	const transport = createTauriTransport(mediaSourceId);
	const [visibleMediaIds, setVisibleMediaIds] = createSignal<readonly string[]>(
		[],
	);
	const selection = useMediaCollectionSelection(visibleMediaIds);
	const [isBulkSelectMode, setIsBulkSelectMode] = createSignal(false);
	const [isBulkActionOpen, setIsBulkActionOpen] = createSignal(false);
	const selectedMediaIds = () => [...selection.selectedIds()];
	const handleSelection = (
		mediaId: string,
		mode: MediaCollectionSelectionMode,
	) => {
		setIsBulkSelectMode(true);
		selection.select(mediaId, mode);
	};
	const clearSelection = () => {
		setIsBulkSelectMode(false);
		selection.clear();
	};
	const currentReturnPath = () => {
		const current = location();
		return `${current.pathname}${current.searchStr}${current.hash}`;
	};
	const rememberMediaReturn = (media: Media, context?: Media[]) => {
		const returnPath = currentReturnPath();
		saveMediaContext(returnPath, context ?? [media]);
	};

	return (
		<>
			<SourceMediaPageComponent
				enableVirtualization
				mediaSourceId={mediaSourceId}
				mediaSourceName={mediaSourceName}
				detailBasePath={router.history.createHref("/sources")}
				transport={transport}
				presetClient={presetClient}
				searchHistoryClient={searchHistoryClient}
				actions={{
					searchMedia,
					uploadMedia: (sourceId, file, options) =>
						uploadMedia(sourceId, file, options),
					deleteMedia,
					copyMedia,
					moveMedia,
					syncMediaItems,
					startDownloadJobs,
				}}
				getSearchCondition={getSearchCondition}
				sortBy={() => searchState.sortBy}
				sortOrder={() => searchState.sortOrder}
				onThumbnailReady={notifyThumbnailReady}
				tagsQueryOptions={tagsQueryOptions}
				projectsQueryOptions={allProjectsQueryOptions}
				ipsQueryOptions={allIpsQueryOptions}
				charactersQueryOptions={allCharactersQueryOptions}
				authorsQueryOptions={allAuthorsQueryOptions}
				onToggleSelect={(mediaId) => handleSelection(mediaId, "toggle")}
				onSelectMedia={handleSelection}
				onVisibleMediaIdsChange={setVisibleMediaIds}
				isBulkSelectMode={isBulkSelectMode}
				isSelected={selection.isSelected}
				onBulkAction={() => setIsBulkActionOpen(true)}
				onClearSelection={clearSelection}
				selectedCount={() => selectedMediaIds().length}
				onEnterBulkSelectMode={() => setIsBulkSelectMode(true)}
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
				onFindSimilar={(media) => {
					activateSimilaritySearch(media.id);
					void navigate({ to: "/search" });
				}}
				renderItem={(media, options) => (
					<MediaGridItem
						imageLoadPolicy={options.imageLoadPolicy}
						isBulkSelectMode={options.isBulkSelectMode}
						isPreviewSelected={options.isPreviewSelected}
						isSelected={options.isSelected}
						media={media}
						onContextMenu={options.onContextMenu}
						onOpenMediaDetail={options.onOpenMediaDetail}
						onPrepareMediaDetail={options.onPrepareMediaDetail}
						onPreviewSelect={options.onPreviewSelect}
						onSelectGesture={options.onSelectGesture}
						onToggleSelect={options.onToggleSelect}
						priority={options.priority}
						sourceRootPath={sourceRootPathResolver(media.mediaSourceId)}
					/>
				)}
				moveCopyDialogComponent={MoveCopyMediaDialog}
				uploadModalComponent={UploadMediaModal}
				showOpenInNewTab
			/>
			<BulkActionDialog
				bulkCopyToSource={bulkCopyToSource}
				bulkDeleteMedia={bulkDeleteMedia}
				bulkMoveMedia={bulkMoveMedia}
				bulkMoveToSource={bulkMoveToSource}
				listSources={fetchMediaSources}
				mediaIds={selectedMediaIds()}
				mediaSourceId={mediaSourceId()}
				onOpenChange={setIsBulkActionOpen}
				onSuccess={(partial) => {
					if (!partial) clearSelection();
				}}
				open={isBulkActionOpen()}
			/>
		</>
	);
}
