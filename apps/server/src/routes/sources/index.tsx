import { useSourcesPage } from "@solid-imager/ui/hooks/use-sources-page";
import { SourcesScreen } from "@solid-imager/ui/screens/sources-screen";
import { SourceCard } from "@solid-imager/ui/source-card";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import SourceDeleteModal from "~/components/source-delete-modal";
import SourceFormModal from "~/components/source-form-modal";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { mediaSourcesQueryOptions } from "~/infrastructure/api-clients/queries/sources-query";
import {
	createMediaSource,
	deleteMediaSource,
	syncMediaSources,
	updateMediaSource,
} from "~/infrastructure/api-clients/sources-api";
import { logger } from "~/infrastructure/logger";

export const Route = createFileRoute("/sources/")({
	ssr: true,
	beforeLoad: ({ context }) => {
		void context;
	},
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(mediaSourcesQueryOptions());
	},
	component: Sources,
});

const _UUID_PREFIX_LENGTH = 4;

export default function Sources() {
	const queryClient = useQueryClient();
	const mediaSources = createQuery(() => mediaSourcesQueryOptions());

	const page = useSourcesPage({
		actions: {
			createMediaSource: (data: unknown) => createMediaSource(data as any),
			updateMediaSource: (id: string, data: unknown) =>
				updateMediaSource(id, data as any),
			deleteMediaSource,
			syncMediaSources,
		},
		queryClient,
		invalidateQueryKey: "mediaSources",
		registerEvents: (handlers) => {
			const ac = new AbortController();

			const startStreamForSource = async (id: string) => {
				try {
					const events = await orpc.sources.events(
						{ id },
						{ signal: ac.signal },
					);

					for await (const msg of events) {
						if (ac.signal.aborted) {
							break;
						}

						const { event, data } = msg;

						switch (event) {
							case "all-jobs-completed":
								handlers.onAllJobsCompleted({
									sourceId: id,
									processed: data?.processed,
								});
								break;
							case "watcher-error":
								handlers.onWatcherError({
									sourceId: id,
									error: data?.error,
								});
								break;
							default:
								break;
						}
					}
				} catch (err) {
					if (!ac.signal.aborted) {
						logger.error({ err }, "Event stream error");
					}
				}
			};

			const sources = mediaSources.data;
			if (sources) {
				for (const source of sources) {
					if (source.id) {
						startStreamForSource(source.id);
					}
				}
			}

			return () => {
				ac.abort();
			};
		},
	});

	return (
		<SourcesScreen
			page={page}
			mediaSources={() => mediaSources.data}
			isLoading={mediaSources.isLoading}
			isError={mediaSources.isError}
			error={mediaSources.error ?? null}
			renderSourceCard={(source) => (
				<SourceCard
					mediaSource={source}
					onDelete={page.handleDeleteSource}
					onEdit={page.handleEditSource}
					onSync={page.handleSyncSource}
				/>
			)}
			renderFormModal={(props) => (
				<SourceFormModal
					editingSource={props.editingSource}
					isOpen={props.isOpen}
					onClose={props.onClose}
					onSubmit={props.onSubmit}
				/>
			)}
			renderDeleteModal={(props) => (
				<SourceDeleteModal
					isOpen={props.isOpen}
					onClose={props.onClose}
					onConfirm={props.onConfirm}
					sourceToDelete={props.sourceToDelete}
				/>
			)}
		/>
	);
}
