import { createPresetClient } from "@solid-imager/ui/preset-client";
import { SourceMediaPage as SourceMediaPageComponent } from "@solid-imager/ui/source-media-page";
import { useParams } from "@tanstack/solid-router";
import { MediaGridItem } from "~/components/media/media-grid-item";
import { MoveCopyMediaDialog } from "~/components/media/move-copy-media-dialog";
import { UploadMediaModal } from "~/components/upload-media-modal";
import { createServerTransport } from "~/hooks/use-media-source-events";
import { PresetClient as rawPresetClient } from "~/infrastructure/api/clients/preset-client";
import { startDownloadJobs } from "~/infrastructure/api-clients/downloads-api";
import {
	copyMedia,
	deleteMedia,
	moveMedia,
	syncMediaItems,
	uploadMedia,
} from "~/infrastructure/api-clients/media-api";
import {
	allAuthorsQueryOptions,
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	tagsQueryOptions,
} from "~/infrastructure/api-clients/queries";
import { searchMedia } from "~/infrastructure/api-clients/search-api";
import {
	fetchSourceDump,
	importSourceZip,
	restoreSource,
} from "~/infrastructure/api-clients/sources-api";
import {
	getSearchCondition,
	searchState,
} from "~/presentation/store/search-store";

const PresetClient = createPresetClient(rawPresetClient);

export function SourceMediaPage() {
	const params = useParams({ from: "/sources/$mediaSourceId/" });
	const mediaSourceId = () => params().mediaSourceId;

	const transport = createServerTransport(mediaSourceId);

	return (
		<SourceMediaPageComponent
			enableVirtualization
			mediaSourceId={mediaSourceId}
			transport={transport}
			presetClient={PresetClient}
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
			}}
			getSearchCondition={getSearchCondition}
			sortBy={() => searchState.sortBy}
			sortOrder={() => searchState.sortOrder}
			tagsQueryOptions={tagsQueryOptions}
			projectsQueryOptions={allProjectsQueryOptions}
			ipsQueryOptions={allIpsQueryOptions}
			charactersQueryOptions={allCharactersQueryOptions}
			authorsQueryOptions={allAuthorsQueryOptions}
			renderItem={(media, { onContextMenu }) => (
				<MediaGridItem media={media} onContextMenu={onContextMenu} />
			)}
			moveCopyDialogComponent={MoveCopyMediaDialog}
			uploadModalComponent={UploadMediaModal}
			showOpenInNewTab
		/>
	);
}
