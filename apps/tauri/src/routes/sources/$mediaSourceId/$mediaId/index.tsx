import { Button } from "@solid-imager/ui/button";
import { useSourceRootPath } from "@solid-imager/ui/hooks/use-source-root-path";
import { projectsQueryKeys } from "@solid-imager/ui/query-options";
import { RouteDataPendingScreen } from "@solid-imager/ui/router-status";
import { V2MediaDetailScreen } from "@solid-imager/ui/screens/v2-media-detail-screen";
import { ArrowLeft } from "@solid-imager/ui/v2/icons";
import { useQueryClient } from "@tanstack/solid-query";
import {
	createFileRoute,
	useNavigate,
	useRouterState,
} from "@tanstack/solid-router";
import { TauriV2MediaSidebar } from "~/components/media/v2-media-sidebar";
import { V2MediaViewer } from "~/components/media/v2-media-viewer";
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
	const navigate = useNavigate();
	const mediaSourceId = () =>
		currentParams()?.mediaSourceId ?? routeData().mediaSourceId;
	const mediaId = () => currentParams()?.mediaId ?? routeData().mediaId;

	const sourceRootPathResolver = useSourceRootPath(mediaSourcesQueryOptions);

	return (
		<V2MediaDetailScreen
			mediaDetailsQueryOptions={mediaDetailsQueryOptions}
			mediaId={mediaId}
			mediaSourceId={mediaSourceId}
			onAdditionalInvalidate={async () => {
				await queryClient.invalidateQueries({
					queryKey: projectsQueryKeys.forMedia(mediaId()),
				});
			}}
			renderHeader={(media, _isUpdating, _onUpdate) => (
				<header class="shrink-0 border-[var(--v2-border)] border-b bg-[var(--v2-surface-subtle)] px-3 py-2 sm:px-4">
					<div class="flex min-w-0 items-center gap-2">
						<Button
							aria-label="一覧に戻る"
							class="size-10 shrink-0 p-0 md:size-9"
							onClick={() =>
								void navigate({
									params: { mediaSourceId: media.mediaSourceId },
									to: "/sources/$mediaSourceId",
								})
							}
							size="icon"
							variant="ghost"
						>
							<ArrowLeft aria-hidden="true" size={17} />
						</Button>
						<div class="min-w-0">
							<h1 class="truncate font-semibold text-sm text-[var(--v2-text)]">
								{media.fileName}
							</h1>
							<p class="truncate text-[11px] text-[var(--v2-text-muted)]">
								Media detail
							</p>
						</div>
					</div>
				</header>
			)}
			renderMediaSidebar={(media, isUpdating, onUpdate) => (
				<TauriV2MediaSidebar
					isUpdating={isUpdating}
					media={media}
					onUpdate={onUpdate}
				/>
			)}
			renderMediaViewer={(media) => <V2MediaViewer media={media} />}
			sourceRootPath={sourceRootPathResolver(mediaSourceId())}
			transport={createTauriTransport(mediaSourceId)}
		/>
	);
}
