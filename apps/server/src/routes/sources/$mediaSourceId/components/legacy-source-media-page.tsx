import { SourceMediaScreen } from "@solid-imager/ui/screens/source-media-screen";
import type { Accessor } from "solid-js";
import { LegacyMediaGridItem } from "~/components/media/legacy-media-grid-item";
import { UploadMediaModal } from "~/components/upload-media-modal";
import { SourceMediaPageController } from "./source-media-page";

export function SourceMediaPage(
	props: { mediaSourceId?: Accessor<string> } = {},
) {
	return (
		<SourceMediaPageController
			mediaSourceId={props.mediaSourceId}
			persistenceSurface="legacy"
			bulkActionsClass="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-background/95 px-3 py-3 shadow-lg backdrop-blur sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:w-auto sm:max-w-none sm:flex-nowrap sm:gap-4 sm:rounded-full sm:px-6"
			renderItem={(media, options, onToggleSelect) => (
				<LegacyMediaGridItem
					imageLoadPolicy={options.imageLoadPolicy}
					isBulkSelectMode={options.isBulkSelectMode}
					isSelected={options.isSelected}
					media={media}
					onContextMenu={options.onContextMenu}
					onToggleSelect={onToggleSelect}
					priority={options.priority}
				/>
			)}
			screenComponent={SourceMediaScreen}
			uploadModalComponent={UploadMediaModal}
		/>
	);
}
