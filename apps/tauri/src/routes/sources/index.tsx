import { mediaSourceInfoSchema } from "@solid-imager/core/domain/sources/schemas";
import { subscribeToEventStream } from "@solid-imager/ui/event-stream";
import type { RawEventHandler } from "@solid-imager/ui/hooks/use-sources-events";
import { useSourcesPage } from "@solid-imager/ui/hooks/use-sources-page";
import { toQueryUiState } from "@solid-imager/ui/query-state";
import { SourcesScreen } from "@solid-imager/ui/screens/sources-screen";
import { SourceCard } from "@solid-imager/ui/source-card";
import { SourceDeleteModal } from "@solid-imager/ui/source-delete-modal";
import { SourceFormModal } from "@solid-imager/ui/source-form-modal";
import { useLiveQuery } from "@tanstack/solid-db";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { getCollections } from "~/collections";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import {
	createMediaSource,
	deleteMediaSource,
	syncMediaSources,
	updateMediaSource,
} from "~/infrastructure/api-clients/sources-api";
import { mediaSourcesQueryOptions } from "~/queries";

export const Route = createFileRoute("/sources/")({
	loader: ({ context }) => {
		void context.queryClient.prefetchQuery(mediaSourcesQueryOptions());
	},
	component: SourcesRoute,
});

function registerSourceEvents(handler: RawEventHandler): () => void {
	return subscribeToEventStream(
		(signal) => orpc.sources.events({ id: "*" }, { signal }),
		handler,
	);
}

function SourcesRoute() {
	const queryClient = useQueryClient();
	const { sources } = getCollections();
	const mediaSources = useLiveQuery(() => sources);
	const mediaSourcesQuery = createQuery(() => mediaSourcesQueryOptions());
	const sourceData = () => {
		const cachedSources = mediaSources();
		return cachedSources.length > 0 || mediaSources.isReady
			? cachedSources
			: undefined;
	};

	const page = useSourcesPage({
		actions: {
			createMediaSource: async (data: unknown) => {
				await createMediaSource(mediaSourceInfoSchema.parse(data));
				await sources.utils.refetch();
			},
			updateMediaSource: async (id: string, data: unknown) => {
				await updateMediaSource(id, mediaSourceInfoSchema.parse(data));
				await sources.utils.refetch();
			},
			deleteMediaSource: async (id: string) => {
				await deleteMediaSource(id);
				await sources.utils.refetch();
			},
			syncMediaSources: async (ids: string[]) => {
				await syncMediaSources(ids);
				await sources.utils.refetch();
			},
		},
		queryClient,
		invalidateQueryKey: mediaSourcesQueryOptions().queryKey,
		registerEvents: registerSourceEvents,
		getSourceIds: () =>
			(sourceData() ?? [])
				.map((s) => s.id ?? s.name)
				.filter((id): id is string => Boolean(id)) ?? [],
	});

	return (
		<SourcesScreen
			page={page}
			mediaSources={sourceData}
			onRetry={async () => {
				await Promise.all([
					mediaSourcesQuery.refetch(),
					sources.utils.refetch(),
				]);
			}}
			state={() =>
				toQueryUiState(
					{
						data: sourceData(),
						error:
							mediaSourcesQuery.error ??
							(mediaSources.isError
								? new Error("保存済みのソースを読み込めませんでした")
								: undefined),
						status: mediaSources.isError ? "error" : mediaSourcesQuery.status,
						fetchStatus: mediaSourcesQuery.fetchStatus,
					},
					{ isEmpty: (data) => data.length === 0 },
				)
			}
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
