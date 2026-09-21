import { useSourceRootPath } from "@solid-imager/ui/hooks/use-source-root-path";
import { MediaDetailHeader } from "@solid-imager/ui/media-detail-header";
import { projectsQueryKeys } from "@solid-imager/ui/query-options";
import { RouteDataPendingScreen } from "@solid-imager/ui/router-status";
import { MediaDetailScreen } from "@solid-imager/ui/screens/media-detail-screen";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, useRouterState } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { MediaActions } from "~/components/media/media-actions";
import { MediaSidebar } from "~/components/media/media-sidebar";
import { MediaViewer } from "~/components/media/media-viewer";
import { createTauriTransport } from "~/hooks/use-media-source-events";
import { mediaDetailsQueryOptions, mediaSourcesQueryOptions } from "~/queries";

export const Route = createFileRoute("/sources/$mediaSourceId/$mediaId/")({
	loader: ({ context, params }) => {
		void context.queryClient.prefetchQuery(mediaSourcesQueryOptions());
		void context.queryClient.prefetchQuery(
			mediaDetailsQueryOptions(params.mediaSourceId, params.mediaId),
		);
		return {
			mediaId: params.mediaId,
			mediaSourceId: params.mediaSourceId,
		};
	},
	pendingComponent: () => (
		<RouteDataPendingScreen
			description="メディア詳細を準備しています..."
			layout="media-detail"
			showDescription
			title="メディア詳細"
		/>
	),
	component: MediaDetailRoute,
});

function MediaDetailRoute() {
	const routeData = Route.useLoaderData();
	const currentParams = useRouterState({
		select: (state) =>
			state.matches.find((match) => match.routeId === Route.id)?.params,
	});
	const queryClient = useQueryClient();
	const mediaSourceId = () =>
		currentParams()?.mediaSourceId ?? routeData().mediaSourceId;
	const mediaId = () => currentParams()?.mediaId ?? routeData().mediaId;

	const sourceRootPathResolver = useSourceRootPath(mediaSourcesQueryOptions);
	const sourceRootPath = () => sourceRootPathResolver(mediaSourceId());
	const mediaSources = createQuery(mediaSourcesQueryOptions);
	const sourceName = () =>
		mediaSources.data?.find((source) => source.id === mediaSourceId())?.name ??
		"Media source";
	const routeKey = () => `${mediaSourceId()}:${mediaId()}`;

	return (
		<Show keyed when={routeKey()}>
			{(_key) => (
				<MediaDetailScreen
					mediaDetailsQueryOptions={mediaDetailsQueryOptions}
					mediaId={mediaId}
					mediaSourceId={mediaSourceId}
					onAdditionalInvalidate={async () => {
						await queryClient.invalidateQueries({
							queryKey: projectsQueryKeys.forMedia(mediaId()),
						});
					}}
					renderHeader={(media, _isUpdating, onUpdate) => (
						<MediaDetailHeader
							media={media}
							onUpdate={() => void onUpdate()}
							renderActions={(actionMedia, actionOnUpdate) => (
								<MediaActions media={actionMedia} onUpdate={actionOnUpdate} />
							)}
							sourceName={sourceName()}
						/>
					)}
					renderMediaSidebar={(media, isUpdating, onUpdate) => (
						<MediaSidebar
							isUpdating={isUpdating}
							media={media}
							onUpdate={onUpdate}
						/>
					)}
					renderMediaViewer={(media) => <MediaViewer media={media} />}
					sourceRootPath={sourceRootPath()}
					transport={createTauriTransport(mediaSourceId)}
				/>
			)}
		</Show>
	);
}
