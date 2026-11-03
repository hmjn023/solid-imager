import { searchSnapshotStateSchema } from "@solid-imager/core/search";
import { createPresetClient } from "@solid-imager/ui/preset-client";
import { SearchWorkspace } from "@solid-imager/ui/screens/search";
import { useSearchWorkspace } from "@solid-imager/ui/search";
import { createSearchHistoryClient } from "@solid-imager/ui/search/history";
import { searchState } from "@solid-imager/ui/search/state";
import { toast } from "@solid-imager/ui/toast";
import { useLocation } from "@tanstack/solid-router";
import { useWorkspaceNavigation } from "~/presentation/workspace-navigation";
import { MediaGridItem } from "~/components/media/media-grid-item";
import { ThumbnailImage } from "~/components/media/thumbnail-image";
import { useMediaSourceEvents } from "~/hooks/use-media-source-events";
import { useWorkspaceView } from "~/presentation/workspace-view";
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
import { fetchMediaSources } from "~/infrastructure/api-clients/sources-api";
import {
	allAuthorsQueryOptions,
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	mediaSourcesQueryOptions,
	tagsQueryOptions,
} from "~/infrastructure/api-clients/queries";
import {
	searchMedia,
	searchSimilar,
	searchSemantic,
} from "~/infrastructure/api-clients/search-api";

const presetClient = createPresetClient(rawPresetClient);
const historyClient = createSearchHistoryClient(rawSearchHistoryClient);

export default function SearchContent() {
	const location = useLocation();
	const workspace = useWorkspaceNavigation();
	const controller = useSearchWorkspace({
		searchMedia,
		searchSimilar,
		searchSemantic,
		historyClient,
		queries: {
			tags: tagsQueryOptions,
			sources: mediaSourcesQueryOptions,
			projects: allProjectsQueryOptions,
			ips: allIpsQueryOptions,
			characters: allCharactersQueryOptions,
			authors: allAuthorsQueryOptions,
		},
		operations: { deleteMedia, copyMedia, moveMedia },
		notify: toast,
	});
	const { page, history, actions } = controller;
	useWorkspaceView(() => ({
		kind: "search",
		snapshotId: location().search.search,
		searchKey: JSON.stringify(searchSnapshotStateSchema.parse(searchState)),
		resultsCurrent: page.resultsCurrent(),
		ready: history.isRestored(),
		state: page.contentState(),
		media: page.searchResults(),
		total: page.totalCount() ?? 0,
		selectedIds: [...actions.selection.selectedIds()],
	}));
	useMediaSourceEvents(() => controller.selectedSource() || "*", {
		onMediaAdded: page.refreshSearchResults,
		onMediaDeleted: page.refreshSearchResults,
		onMediaChanged: page.refreshSearchResults,
		onMediaCopied: page.refreshSearchResults,
		onMediaMoved: page.refreshSearchResults,
		onAllJobsCompleted: page.refreshSearchResults,
	});
	return (
		<SearchWorkspace
			controller={controller}
			presetClient={presetClient}
			operations={{
				listSources: fetchMediaSources,
				bulkCopyToSource,
				bulkDeleteMedia,
				bulkMoveMedia,
				bulkMoveToSource,
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
					onPreviewSelect={options?.onPreviewSelect}
					onSelectGesture={options?.onSelectGesture}
					onToggleSelect={options?.onToggleSelect}
					priority={options?.priority}
					onPrepareMediaDetail={options?.onPrepareMediaDetail}
				/>
			)}
			onPrepareMediaDetail={workspace.prepareMediaDetail}
			onOpenMediaDetail={workspace.openMediaDetail}
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
		/>
	);
}
