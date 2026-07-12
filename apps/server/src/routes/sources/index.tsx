import { mediaSourceInfoSchema } from "@solid-imager/core/domain/sources/schemas";
import { subscribeToEventStream } from "@solid-imager/ui/event-stream";
import type { RawEventHandler } from "@solid-imager/ui/hooks/use-sources-events";
import { useSourcesPage } from "@solid-imager/ui/hooks/use-sources-page";
import { toQueryUiState } from "@solid-imager/ui/query-state";
import { SourcesScreen } from "@solid-imager/ui/screens/sources-screen";
import { SourceCard } from "@solid-imager/ui/source-card";
import { SourceDeleteModal } from "@solid-imager/ui/source-delete-modal";
import { SourceFormModal } from "@solid-imager/ui/source-form-modal";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { ClientOnly, createFileRoute } from "@tanstack/solid-router";
import { isServer } from "solid-js/web";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { mediaSourcesQueryOptions } from "~/infrastructure/api-clients/queries";
import {
	createMediaSource,
	deleteMediaSource,
	syncMediaSources,
	updateMediaSource,
} from "~/infrastructure/api-clients/sources-api";

export const Route = createFileRoute("/sources/")({
	ssr: false,
	pendingComponent: () => null,
	component: SourcesRoute,
});

function registerSourceEvents(handler: RawEventHandler): () => void {
	return subscribeToEventStream(
		(signal) => orpc.sources.events({ id: "*" }, { signal }),
		handler,
	);
}

function SourcesRoute() {
	return (
		<ClientOnly fallback={null}>
			<SourcesRouteContent />
		</ClientOnly>
	);
}

function SourcesRouteContent() {
	const queryClient = useQueryClient();
	const mediaSources = createQuery(() => ({
		...mediaSourcesQueryOptions(),
		enabled: !isServer,
	}));

	const page = useSourcesPage({
		actions: {
			createMediaSource: (data: unknown) =>
				createMediaSource(mediaSourceInfoSchema.parse(data)),
			updateMediaSource: (id: string, data: unknown) =>
				updateMediaSource(id, mediaSourceInfoSchema.parse(data)),
			deleteMediaSource,
			syncMediaSources,
		},
		queryClient,
		invalidateQueryKey: mediaSourcesQueryOptions().queryKey,
		registerEvents: registerSourceEvents,
		getSourceIds: () =>
			mediaSources.data
				?.map((s) => s.id)
				.filter((id): id is string => Boolean(id)) ?? [],
	});

	return (
		<SourcesScreen
			page={page}
			mediaSources={() => mediaSources.data}
			state={() =>
				toQueryUiState(mediaSources, {
					isEmpty: (data) => data.length === 0,
				})
			}
			onRetry={() => {
				void mediaSources.refetch();
			}}
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
