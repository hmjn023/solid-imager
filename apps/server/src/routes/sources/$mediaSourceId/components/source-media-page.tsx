import type { MediaSourceEventTransport } from "@solid-imager/ui/hooks/use-media-source-events";
import { useSourceMediaPage } from "@solid-imager/ui/hooks/use-source-media-page";
import {
	SourceMediaScreen,
	type SourceMediaScreenProps,
} from "@solid-imager/ui/screens/source-media-screen";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { useParams } from "@tanstack/solid-router";
import type { Accessor } from "solid-js";
import { MediaGridItem } from "~/components/media/media-grid-item";
import { MoveCopyMediaDialog } from "~/components/media/move-copy-media-dialog";
import { UploadMediaModal } from "~/components/upload-media-modal";
import { PresetClient } from "~/infrastructure/api/clients/preset-client";
import { startDownloadJobs } from "~/infrastructure/api-clients/downloads-api";
import {
	copyMedia,
	deleteMedia,
	moveMedia,
	syncMediaItems,
	uploadMedia,
} from "~/infrastructure/api-clients/media-api";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { allAuthorsQueryOptions } from "~/infrastructure/api-clients/queries/authors-query";
import { allCharactersQueryOptions } from "~/infrastructure/api-clients/queries/characters-query";
import { allIpsQueryOptions } from "~/infrastructure/api-clients/queries/ips-query";
import { allProjectsQueryOptions } from "~/infrastructure/api-clients/queries/projects-query";
import { tagsQueryOptions } from "~/infrastructure/api-clients/queries/tags-query";
import { searchMedia } from "~/infrastructure/api-clients/search-api";
import {
	fetchSourceDump,
	importSourceZip,
	restoreSource,
} from "~/infrastructure/api-clients/sources-api";
import { logger } from "~/infrastructure/logger";
import {
	getSearchCondition,
	searchState,
} from "~/presentation/store/search-store";
import { MediaListActions } from "./media-list-actions";

function createServerTransport(
	mediaSourceId: Accessor<string | undefined>,
): MediaSourceEventTransport {
	return {
		listen(handler) {
			const id = mediaSourceId();
			if (!id) {
				return () => {
					/* no-op */
				};
			}

			const ac = new AbortController();

			const startEventStream = async () => {
				try {
					const events = await orpc.sources.events(
						{ id },
						{ signal: ac.signal },
					);

					for await (const msg of events) {
						if (ac.signal.aborted) {
							break;
						}
						handler(msg.event, msg.data);
					}
				} catch (err) {
					if (!ac.signal.aborted) {
						logger.error({ err }, "Event stream error");
					}
				}
			};

			startEventStream();

			return () => {
				ac.abort();
			};
		},
	};
}

export function SourceMediaPage() {
	const params = useParams({ from: "/sources/$mediaSourceId/" });
	const queryClient = useQueryClient();

	const mediaSourceId = () => params().mediaSourceId;

	const tags = createQuery(() => tagsQueryOptions());
	const allProjects = createQuery(() => allProjectsQueryOptions());
	const allIps = createQuery(() => allIpsQueryOptions());
	const allCharacters = createQuery(() => allCharactersQueryOptions());
	const allAuthors = createQuery(() => allAuthorsQueryOptions());

	const transport = createServerTransport(mediaSourceId);

	const page = useSourceMediaPage({
		mediaSourceId,
		queries: {
			tags: () => tags.data,
			projects: () => allProjects.data,
			ips: () => allIps.data,
			characters: () => allCharacters.data,
			authors: () => allAuthors.data,
		},
		actions: {
			searchMedia,
			uploadMedia: (sourceId, file, opts) => uploadMedia(sourceId, file, opts),
			deleteMedia,
			copyMedia,
			moveMedia,
			syncMediaItems,
			startDownloadJobs,
			fetchSourceDump,
			restoreSource: (sourceId, data) => restoreSource(sourceId, data),
			importSourceZip: (sourceId, file) => importSourceZip(sourceId, file),
		},
		queryClient,
		presetClient: PresetClient,
		transport,
		getSearchCondition,
		sortBy: () => searchState.sortBy,
		sortOrder: () => searchState.sortOrder,
	});

	const renderActions: SourceMediaScreenProps["renderActions"] = (_props) => (
		<MediaListActions
			filterData={page.filterData()}
			onDumpDownload={page.handleDumpDownload}
			onSearch={page.handleSearch}
		/>
	);

	return (
		<SourceMediaScreen
			page={page}
			renderActions={renderActions}
			renderItem={(media, { onContextMenu }) => (
				<MediaGridItem media={media} onContextMenu={onContextMenu} />
			)}
			renderMoveCopyDialog={() => (
				<MoveCopyMediaDialog
					currentSourceId={page.mediaSourceId() || ""}
					mode={page.moveCopyMode()}
					onConfirm={page.handleConfirmCopyMove}
					onOpenChange={page.setMoveCopyDialogOpen}
					open={page.moveCopyDialogOpen()}
				/>
			)}
			renderUploadModal={() => (
				<UploadMediaModal
					initialFile={page.fileToUpload()}
					isOpen={page.showUploadModal()}
					onClose={() => {
						page.setShowUploadModal(false);
						page.setPastedUrl(null);
						page.setFileToUpload(null);
					}}
					onUpload={page.handleUpload}
					onUrlFetch={(file) => page.setFileToUpload(file)}
					pastedUrl={page.pastedUrl()}
				/>
			)}
			showOpenInNewTab
		/>
	);
}
