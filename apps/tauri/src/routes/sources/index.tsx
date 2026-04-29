import { SourceCard } from "@solid-imager/ui/source-card";
import { SourcesScreen } from "@solid-imager/ui/screens/sources-screen";
import { useSourcesPage } from "@solid-imager/ui/hooks/use-sources-page";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { listen } from "@tauri-apps/api/event";
import { SourceDeleteModal } from "~/components/source-delete-modal";
import { SourceFormModal } from "~/components/source-form-modal";
import { mediaSourcesQueryOptions } from "~/infrastructure/api-clients/queries/sources-query";
import {
	createMediaSource,
	deleteMediaSource,
	syncMediaSources,
	updateMediaSource,
} from "~/infrastructure/api-clients/sources-api";

export const Route = createFileRoute("/sources/")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(mediaSourcesQueryOptions());
	},
	component: SourcesRoute,
});

function SourcesRoute() {
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
			const sources = mediaSources.data;
			if (!sources?.length) {
				return () => {};
			}

			const sourceIds = new Set(
				sources.map((s) => s.id).filter((id): id is string => Boolean(id)),
			);

			const unlistenPromises = [
				listen("all-jobs-completed", (event) => {
					const payload = event.payload as {
						mediaSourceId?: string;
						processed?: number;
					};
					if (
						!(payload.mediaSourceId && sourceIds.has(payload.mediaSourceId))
					) {
						return;
					}
					handlers.onAllJobsCompleted({
						sourceId: payload.mediaSourceId,
						processed: payload.processed,
					});
				}),
				listen("watcher-error", (event) => {
					const payload = event.payload as {
						mediaSourceId?: string;
						error?: string;
					};
					if (
						!(payload.mediaSourceId && sourceIds.has(payload.mediaSourceId))
					) {
						return;
					}
					handlers.onWatcherError({
						sourceId: payload.mediaSourceId,
						error: payload.error,
					});
				}),
			];

			return () => {
				void Promise.all(unlistenPromises).then((unlisteners) => {
					for (const unlisten of unlisteners) {
						unlisten();
					}
				});
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
					href={source.id ? `#/sources/${source.id}` : "#/sources"}
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
