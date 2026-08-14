import { mediaSourceInfoSchema } from "@solid-imager/core/domain/sources/schemas";
import type { RawEventHandler } from "@solid-imager/ui/hooks/use-sources-events";
import { useSourcesPage } from "@solid-imager/ui/hooks/use-sources-page";
import { LegacySourceFormModal } from "@solid-imager/ui/legacy-source-form-modal";
import { toQueryUiState } from "@solid-imager/ui/query-state";
import { RouteDataPendingScreen } from "@solid-imager/ui/router-status";
import { SourcesScreen } from "@solid-imager/ui/screens/sources-screen";
import { SourceCard } from "@solid-imager/ui/source-card";
import { SourceDeleteModal } from "@solid-imager/ui/source-delete-modal";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { createServerTransport } from "~/hooks/use-media-source-events";
import { mediaSourcesQueryOptions } from "~/infrastructure/api-clients/queries";
import {
	createMediaSource,
	deleteMediaSource,
	syncMediaSources,
	updateMediaSource,
} from "~/infrastructure/api-clients/sources-api";
import type { RouteLoaderContext } from "~/infrastructure/router/route-types";

export const Route = createFileRoute("/sources/")({
	ssr: true,
	loader: async ({ context }: RouteLoaderContext) => {
		const mediaSources = await context.queryClient.fetchQuery(
			mediaSourcesQueryOptions(),
		);
		return { mediaSources };
	},
	pendingComponent: () => (
		<RouteDataPendingScreen
			class="p-6"
			description="ソース一覧を準備しています..."
			layout="cards"
			showAction
			title="Media Sources"
		/>
	),
	pendingMinMs: 0,
	component: SourcesRouteContent,
});

function SourcesRouteContent() {
	const queryClient = useQueryClient();
	const loaderData = Route.useLoaderData();
	const mediaSources = createQuery(mediaSourcesQueryOptions);
	const sourceData = () => mediaSources.data ?? loaderData().mediaSources;
	const sourceEventsTransport = createServerTransport(() => "*");

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
		registerEvents: (handler: RawEventHandler) =>
			sourceEventsTransport.listen(handler),
		getSourceIds: () =>
			sourceData()
				?.map((source: { id?: string }) => source.id)
				.filter((id: string | undefined): id is string => Boolean(id)) ?? [],
	});
	return (
		<SourcesScreen
			page={page}
			mediaSources={sourceData}
			state={() =>
				toQueryUiState(
					{
						data: sourceData(),
						error: mediaSources.error,
						fetchStatus: mediaSources.fetchStatus,
						status: mediaSources.status,
					},
					{ isEmpty: (data) => data.length === 0 },
				)
			}
			onRetry={async () => {
				await mediaSources.refetch();
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
				<LegacySourceFormModal
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
