import type { MediaSourceEventTransport } from "@solid-imager/ui/hooks/use-media-source-events";
import { useSourceMediaPage } from "@solid-imager/ui/hooks/use-source-media-page";
import { MediaListActions } from "@solid-imager/ui/media-list-actions";
import {
	SourceMediaScreen,
	type SourceMediaScreenProps,
} from "@solid-imager/ui/screens/source-media-screen";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { useParams } from "@tanstack/solid-router";
import { listen } from "@tauri-apps/api/event";
import { createMemo } from "solid-js";
import { MediaGridItem } from "~/components/media/media-grid-item";
import { MoveCopyMediaDialog } from "~/components/media/move-copy-media-dialog";
import { UploadMediaModal } from "~/components/upload-media-modal";
import { PresetClient } from "~/infrastructure/api/clients/preset-client";
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
	restoreSource,
} from "~/infrastructure/api-clients/sources-api";
import { notifyThumbnailReady } from "~/infrastructure/media/thumbnail-runtime";
import {
	getSearchCondition,
	searchState,
} from "~/presentation/store/search-store";

function createTauriTransport(
	mediaSourceId: () => string | undefined,
): MediaSourceEventTransport {
	return {
		listen(handler) {
			const id = mediaSourceId();
			if (!id) {
				return () => {
					/* no-op */
				};
			}

			let isCleanedUp = false;

			const EVENT_NAMES = [
				"media-added",
				"media-deleted",
				"media-changed",
				"media-copied",
				"media-moved",
				"thumbnail-generated",
				"all-jobs-completed",
				"watcher-error",
				"job-progress",
			] as const;

			type EventPayload = {
				mediaSourceId?: string;
				sourceId?: string;
				targetId?: string;
				jobId?: string;
			};

			const unlistenPromises = EVENT_NAMES.map((eventName) =>
				listen<EventPayload>(eventName, (event) => {
					if (isCleanedUp) return;

					const payload = event.payload;
					const relevant =
						payload?.mediaSourceId === id ||
						payload?.sourceId === id ||
						payload?.targetId === id ||
						payload?.jobId === id ||
						(payload?.mediaSourceId === undefined &&
							payload?.sourceId === undefined &&
							payload?.targetId === undefined &&
							payload?.jobId === undefined);

					if (relevant) {
						handler(eventName, payload);
					}
				}),
			);

			return () => {
				isCleanedUp = true;
				void Promise.all(unlistenPromises).then((unlistenFns) => {
					for (const unlisten of unlistenFns) {
						unlisten();
					}
				});
			};
		},
	};
}

export function SourceMediaPage() {
	const params = useParams({ from: "/sources/$mediaSourceId/" });
	const mediaSourceId = () => params().mediaSourceId;
	const queryClient = useQueryClient();

	const tags = createQuery(() => tagsQueryOptions());
	const allProjects = createQuery(() => allProjectsQueryOptions());
	const allIps = createQuery(() => allIpsQueryOptions());
	const allCharacters = createQuery(() => allCharactersQueryOptions());
	const allAuthors = createQuery(() => allAuthorsQueryOptions());
	const sources = createQuery(() => mediaSourcesQueryOptions());

	const sourceRootPath = createMemo(() => {
		const current = sources.data?.find((item) => item.id === mediaSourceId());
		if (current?.type !== "local") {
			return undefined;
		}
		const connectionInfo = current.connectionInfo as { path?: string };
		return connectionInfo.path;
	});

	const transport = createTauriTransport(mediaSourceId);

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
			restoreSource,
			importSourceZip,
		},
		queryClient,
		presetClient: PresetClient,
		transport,
		getSearchCondition,
		sortBy: () => searchState.sortBy,
		sortOrder: () => searchState.sortOrder,
		onThumbnailReady: notifyThumbnailReady,
	});

	const renderActions: SourceMediaScreenProps["renderActions"] = () => (
		<MediaListActions
			filterData={page.filterData()}
			onDumpDownload={page.handleDumpDownload}
			onSearch={page.handleSearch}
			presetClient={PresetClient}
		/>
	);

	return (
		<SourceMediaScreen
			enableVirtualization
			page={page}
			renderActions={renderActions}
			renderItem={(media, { onContextMenu }) => (
				<MediaGridItem
					media={media}
					onContextMenu={onContextMenu}
					sourceRootPath={sourceRootPath()}
				/>
			)}
			showOpenInNewTab
			renderMoveCopyDialog={() => (
				<MoveCopyMediaDialog
					currentSourceId={mediaSourceId()}
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
						page.setFileToUpload(null);
						page.setPastedUrl(null);
					}}
					onUpload={page.handleUpload}
					onUrlFetch={(file) => page.setFileToUpload(file)}
					pastedUrl={page.pastedUrl()}
				/>
			)}
		/>
	);
}
