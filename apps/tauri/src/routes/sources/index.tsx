import { useSourcesPage } from "@solid-imager/ui/hooks/use-sources-page";
import { SourcesScreen } from "@solid-imager/ui/screens/sources-screen";
import { SourceCard } from "@solid-imager/ui/source-card";
import { SourceDeleteModal } from "@solid-imager/ui/source-delete-modal";
import { SourceFormModal } from "@solid-imager/ui/source-form-modal";
import { useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { useLiveQuery } from "@tanstack/solid-db";
import { mediaSourcesQueryOptions } from "~/infrastructure/api-clients/queries/sources-query";
import {
	createMediaSource,
	deleteMediaSource,
	syncMediaSources,
	updateMediaSource,
} from "~/infrastructure/api-clients/sources-api";
import { mediaSourceInfoSchema } from "@solid-imager/core/domain/sources/schemas";
import { getCollections } from "~/collections";

export const Route = createFileRoute("/sources/")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(mediaSourcesQueryOptions());
	},
	component: SourcesRoute,
});

function SourcesRoute() {
	const queryClient = useQueryClient();
	const { sources } = getCollections();
	const mediaSources = useLiveQuery(() => sources);

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
		getSourceIds: () =>
			mediaSources()
				?.map((s) => s.id ?? s.name)
				.filter((id): id is string => Boolean(id)) ?? [],
	});

	return (
		<SourcesScreen
			page={page}
			mediaSources={() => mediaSources()}
			isLoading={false}
			isError={false}
			error={null}
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
