import { useSourceRootPath } from "@solid-imager/ui/hooks/use-source-root-path";
import { createPresetClient } from "@solid-imager/ui/preset-client";
import { SourceMediaPage as SourceMediaPageComponent } from "@solid-imager/ui/source-media-page";
import { useParams } from "@tanstack/solid-router";
import { MediaGridItem } from "~/components/media/media-grid-item";
import { MoveCopyMediaDialog } from "~/components/media/move-copy-media-dialog";
import { UploadMediaModal } from "~/components/upload-media-modal";
import { createTauriTransport } from "~/hooks/use-media-source-events";
import { PresetClient as rawPresetClient } from "~/infrastructure/api/clients/preset-client";
import {
	copyMedia,
	deleteMedia,
	moveMedia,
	startDownloadJobs,
	syncMediaItems,
	uploadMedia,
} from "~/infrastructure/api-clients/media-api";
import { searchMedia } from "~/infrastructure/api-clients/search-api";
import {
	fetchSourceDump,
	importSourceZip,
	parseRestoreFile,
	restoreSource,
} from "~/infrastructure/api-clients/sources-api";
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

export function SourceMediaPage() {
	const params = useParams({ from: "/sources/$mediaSourceId/" });
	const mediaSourceId = () => params().mediaSourceId;

	const sourceRootPathResolver = useSourceRootPath(mediaSourcesQueryOptions);

	const transport = createTauriTransport(mediaSourceId);

	return (
		<SourceMediaPageComponent
			mediaSourceId={mediaSourceId}
			transport={transport}
			presetClient={presetClient}
			actions={{
				searchMedia,
				uploadMedia: (sourceId, file, opts) =>
					uploadMedia(sourceId, file, opts),
				deleteMedia,
				copyMedia,
				moveMedia,
				syncMediaItems,
				startDownloadJobs,
				fetchSourceDump,
				restoreSource,
				importSourceZip,
				parseRestoreFile,
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
			renderItem={(media, { onContextMenu }) => (
				<MediaGridItem
					media={media}
					onContextMenu={onContextMenu}
					sourceRootPath={sourceRootPathResolver(mediaSourceId())}
				/>
			)}
			moveCopyDialogComponent={MoveCopyMediaDialog}
			uploadModalComponent={UploadMediaModal}
			showOpenInNewTab
		/>
	);
}
