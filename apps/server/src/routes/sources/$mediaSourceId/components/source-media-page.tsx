import { createSearchHistoryClient } from "@solid-imager/ui/search/history";
import { activateSimilaritySearch } from "@solid-imager/ui/search/state";
import { useNavigate } from "@tanstack/solid-router";
import type { Accessor } from "solid-js";
import { useWorkspaceNavigation } from "~/presentation/workspace-navigation";
import { MediaGridItem } from "~/components/media/media-grid-item";
import { ThumbnailImage } from "~/components/media/thumbnail-image";
import { UploadMediaModal } from "~/components/upload-media-modal";
import { SearchHistoryClient as rawSearchHistoryClient } from "~/infrastructure/api/clients/search-history-client";
import {
	SourceMediaPageController,
	type SourceMediaPageControllerProps,
} from "./source-media-controller";

const SearchHistoryClient = createSearchHistoryClient(rawSearchHistoryClient);

export function SourceMediaPage(props: { mediaSourceId?: Accessor<string> }) {
	const workspace = useWorkspaceNavigation();
	const navigate = useNavigate();
	const onFindSimilar: SourceMediaPageControllerProps["onFindSimilar"] = (
		media,
		model,
	) => {
		activateSimilaritySearch(media.id, model);
		void navigate({ to: "/search" });
	};

	return (
		<SourceMediaPageController
			mediaSourceId={props.mediaSourceId}
			onFindSimilar={onFindSimilar}
			onOpenMediaDetail={workspace.openMediaDetail}
			onPrepareMediaDetail={workspace.prepareMediaDetail}
			searchHistoryClient={SearchHistoryClient}
			renderItem={(media, options, onToggleSelect) => (
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
					onToggleSelect={onToggleSelect}
					priority={options.priority}
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
			scrollContainerSelector={() =>
				`[data-media-scroll="${props.mediaSourceId?.() ?? "source-media"}"]`
			}
			ssrGuard
			uploadModalComponent={UploadMediaModal}
		/>
	);
}
