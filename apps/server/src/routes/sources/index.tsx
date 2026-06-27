import { mediaSourceInfoSchema } from "@solid-imager/core/domain/sources/schemas";
import { subscribeToEventStream } from "@solid-imager/ui/event-stream";
import type { RawEventHandler } from "@solid-imager/ui/hooks/use-sources-events";
import { useSourcesPage } from "@solid-imager/ui/hooks/use-sources-page";
import { SourcesScreen } from "@solid-imager/ui/screens/sources-screen";
import { SourceCard } from "@solid-imager/ui/source-card";
import { SourceDeleteModal } from "@solid-imager/ui/source-delete-modal";
import { SourceFormModal } from "@solid-imager/ui/source-form-modal";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { mediaSourcesQueryOptions } from "~/infrastructure/api-clients/queries";
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

function registerSourceEvents(handler: RawEventHandler): () => void {
	return subscribeToEventStream(
		(signal) => orpc.sources.events({ id: "*" }, { signal }),
		handler,
	);
}

function SourcesRoute() {
	const queryClient = useQueryClient();
	const mediaSources = createQuery(() => mediaSourcesQueryOptions());

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
			isLoading={mediaSources.isLoading}
			isError={mediaSources.isError}
			error={mediaSources.error ?? null}
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
