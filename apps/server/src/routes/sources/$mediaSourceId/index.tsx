import type { MediaSourceEventTransport } from "@solid-imager/ui/hooks/use-media-source-events";
import { createPresetClient } from "@solid-imager/ui/preset-client";
import { SourceMediaPage } from "@solid-imager/ui/source-media-page";
import { createFileRoute, useParams } from "@tanstack/solid-router";
import { createEffect, onCleanup } from "solid-js";
import { MediaGridItem } from "~/components/media/media-grid-item";
import { MoveCopyMediaDialog } from "~/components/media/move-copy-media-dialog";
import { UploadMediaModal } from "~/components/upload-media-modal";
import { PresetClient as rawPresetClient } from "~/infrastructure/api/clients/preset-client";
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
import { mediaSourcesQueryOptions } from "~/infrastructure/api-clients/queries/sources-query";
import { tagsQueryOptions } from "~/infrastructure/api-clients/queries/tags-query";
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

export const Route = createFileRoute("/sources/$mediaSourceId/")({
	loader: async ({ context }) => {
		await Promise.all([
			context.queryClient.ensureQueryData(tagsQueryOptions()),
			context.queryClient.ensureQueryData(allProjectsQueryOptions()),
			context.queryClient.ensureQueryData(allIpsQueryOptions()),
			context.queryClient.ensureQueryData(allCharactersQueryOptions()),
			context.queryClient.ensureQueryData(allAuthorsQueryOptions()),
			context.queryClient.ensureQueryData(mediaSourcesQueryOptions()),
		]);
	},
	component: SourceMediaPageComponent,
});

const orpcWithEvents = orpc as unknown as {
	sources: {
		events: (
			input: { id: string },
			opts?: { signal?: AbortSignal },
		) => Promise<AsyncIterable<{ event: string; data: unknown }>>;
	};
};

function createServerTransport(
	mediaSourceId: () => string | undefined,
): MediaSourceEventTransport {
	return {
		listen(handler) {
			let activeAc: AbortController | null = null;

			createEffect(() => {
				const id = mediaSourceId();
				if (!id) {
					return;
				}

				const ac = new AbortController();
				activeAc = ac;

				const startListening = async () => {
					let retryCount = 0;
					const maxRetryDelay = 30_000;
					const initialRetryDelay = 1_000;

					while (!ac.signal.aborted) {
						try {
							const events = await orpcWithEvents.sources.events(
								{ id },
								{ signal: ac.signal },
							);

							retryCount = 0;

							for await (const msg of events) {
								if (ac.signal.aborted) {
									break;
								}

								if (msg.event === "connected") {
									continue;
								}

								handler(msg.event, msg.data);
							}
						} catch (_err) {
							if (ac.signal.aborted) {
								break;
							}

							retryCount++;
							const delay = Math.min(
								initialRetryDelay * 2 ** (retryCount - 1),
								maxRetryDelay,
							);
							await new Promise<void>((resolve) => {
								const timer = setTimeout(resolve, delay);
								ac.signal.addEventListener(
									"abort",
									() => {
										clearTimeout(timer);
										resolve();
									},
									{ once: true },
								);
							});
						}
					}
				};

				startListening();

				onCleanup(() => {
					ac.abort();
				});
			});

			return () => {
				activeAc?.abort();
			};
		},
	};
}

const wrappedPresetClient = {
	presets: {
		list: () => rawPresetClient.list(),
		get: (input: { id: number }) => rawPresetClient.get(input.id),
		getByName: (input: { name: string }) =>
			rawPresetClient.getByName(input.name),
		create: rawPresetClient.create,
		update: (input: {
			id: number;
			data: Parameters<typeof rawPresetClient.update>[1];
		}) => rawPresetClient.update(input.id, input.data),
		delete: (input: { id: number }) => rawPresetClient.delete(input.id),
	},
};

const PresetClient = createPresetClient(wrappedPresetClient);

function SourceMediaPageComponent() {
	const params = useParams({ from: "/sources/$mediaSourceId/" });
	const mediaSourceId = () => params().mediaSourceId;

	const transport = createServerTransport(mediaSourceId);

	return (
		<SourceMediaPage
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
