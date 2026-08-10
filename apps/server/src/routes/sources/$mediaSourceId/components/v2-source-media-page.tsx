import { V2SourceMediaScreen } from "@solid-imager/ui/screens/v2-source-media-screen";
import { useLocation, useNavigate } from "@tanstack/solid-router";
import type { Accessor } from "solid-js";
import { ThumbnailImage } from "~/components/media/thumbnail-image";
import { V2MediaGridItem } from "~/components/media/v2-media-grid-item";
import { V2UploadMediaModal } from "~/components/v2-upload-media-modal";
import { saveV2MediaContext } from "~/routes/v2/media-context";
import {
	SourceMediaPageController,
	type SourceMediaPageControllerProps,
} from "./source-media-page";

export function V2SourceMediaPage(props: { mediaSourceId?: Accessor<string> }) {
	const location = useLocation();
	const navigate = useNavigate();

	const onOpenMediaDetail: SourceMediaPageControllerProps["onOpenMediaDetail"] =
		(media, context) => {
			sessionStorage.setItem("v2:media-return", location().href);
			saveV2MediaContext(location().href, context ?? [media]);
			void navigate({
				params: {
					mediaId: media.id,
					mediaSourceId: media.mediaSourceId,
				},
				to: "/v2/sources/$mediaSourceId/$mediaId",
			});
		};
	const onPrepareMediaDetail: SourceMediaPageControllerProps["onPrepareMediaDetail"] =
		(media, context) => {
			sessionStorage.setItem("v2:media-return", location().href);
			saveV2MediaContext(location().href, context ?? [media]);
		};

	return (
		<SourceMediaPageController
			mediaSourceId={props.mediaSourceId}
			onOpenMediaDetail={onOpenMediaDetail}
			onPrepareMediaDetail={onPrepareMediaDetail}
			persistenceSurface="v2"
			bulkActionsClass="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-3 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:w-auto sm:max-w-none sm:flex-nowrap sm:gap-3 sm:px-4"
			renderItem={(media, options, onToggleSelect) => (
				<V2MediaGridItem
					imageLoadPolicy={options.imageLoadPolicy}
					isBulkSelectMode={options.isBulkSelectMode}
					isSelected={options.isSelected || options.isPreviewSelected}
					media={media}
					onContextMenu={options.onContextMenu}
					onPrepareMediaDetail={options.onPrepareMediaDetail}
					onPreviewSelect={options.onPreviewSelect}
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
				`[data-media-scroll="${props.mediaSourceId?.() ?? "v2-source"}"]`
			}
			ssrGuard
			screenComponent={V2SourceMediaScreen}
			uploadModalComponent={V2UploadMediaModal}
		/>
	);
}
