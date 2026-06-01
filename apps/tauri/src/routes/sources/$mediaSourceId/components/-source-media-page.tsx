import { createPresetClient } from "@solid-imager/ui/preset-client";
import { SourceMediaPage as SourceMediaPageComponent } from "@solid-imager/ui/source-media-page";
import { createQuery } from "@tanstack/solid-query";
import { useParams } from "@tanstack/solid-router";
import { createMemo } from "solid-js";
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
import { allAuthorsQueryOptions } from "~/infrastructure/api-clients/queries/authors-query";
import { allCharactersQueryOptions } from "~/infrastructure/api-clients/queries/characters-query";
import { allIpsQueryOptions } from "~/infrastructure/api-clients/queries/ips-query";
import { allProjectsQueryOptions } from "~/infrastructure/api-clients/queries/projects-query";
import { mediaSourcesQueryOptions } from "~/infrastructure/api-clients/queries/sources-query";
import { tagsQueryOptions } from "~/infrastructure/api-clients/queries/tags-query";
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

export function SourceMediaPage() {
	const params = useParams({ from: "/sources/$mediaSourceId/" });
	const mediaSourceId = () => params().mediaSourceId;

	const sources = createQuery(() => mediaSourcesQueryOptions());

	const presetClient = createPresetClient(rawPresetClient);

	const sourceRootPath = createMemo(() => {
		const current = sources.data?.find((item) => item.id === mediaSourceId());
		if (current?.type !== "local") {
			return undefined;
		}
		const connectionInfo = current.connectionInfo as { path?: string };
		return connectionInfo.path;
	});

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
			enableVirtualization
			renderItem={(media, { onContextMenu }) => (
				<MediaGridItem
					media={media}
					onContextMenu={onContextMenu}
					sourceRootPath={sourceRootPath()}
				/>
			)}
			moveCopyDialogComponent={MoveCopyMediaDialog}
			uploadModalComponent={UploadMediaModal}
			showOpenInNewTab
		/>
	);
}
