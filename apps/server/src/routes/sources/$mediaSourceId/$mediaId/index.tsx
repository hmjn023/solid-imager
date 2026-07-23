import { RouteDataPendingScreen } from "@solid-imager/ui/router-status";
import { MediaDetailScreen } from "@solid-imager/ui/screens/media-detail-screen";
import { ClientOnly, createFileRoute } from "@tanstack/solid-router";
import { type Accessor, createSignal, onMount, Show } from "solid-js";
import { MediaSidebar } from "~/components/media/media-sidebar";
import { MediaViewer } from "~/components/media/media-viewer";
import { createServerTransport } from "~/hooks/use-media-source-events";
import {
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	mediaDetailsQueryOptions,
	projectsForMediaQueryOptions,
} from "~/infrastructure/api-clients/queries";
import type { RouteLoaderContext } from "~/infrastructure/router/route-types";

interface MediaRouteParams {
	mediaId: string;
	mediaSourceId: string;
}

export const Route = createFileRoute("/sources/$mediaSourceId/$mediaId/")({
	ssr: true,
	loader: async ({ context, params }: RouteLoaderContext<MediaRouteParams>) => {
		await Promise.all([
			context.queryClient.prefetchQuery(
				mediaDetailsQueryOptions(params.mediaSourceId, params.mediaId),
			),
			context.queryClient.prefetchQuery(
				projectsForMediaQueryOptions(params.mediaSourceId, params.mediaId),
			),
			context.queryClient.prefetchQuery(allProjectsQueryOptions()),
			context.queryClient.prefetchQuery(allIpsQueryOptions()),
			context.queryClient.prefetchQuery(allCharactersQueryOptions()),
		]);
		return {
			mediaId: params.mediaId,
			mediaSourceId: params.mediaSourceId,
		};
	},
	pendingComponent: MediaRouteFallback,
	pendingMinMs: 0,
	component: Media,
});

function Media() {
	const [isMounted, setIsMounted] = createSignal(false);

	onMount(() => {
		setIsMounted(true);
	});

	return (
		<Show fallback={<MediaRouteFallback />} when={isMounted()}>
			{(_mounted) => <MediaRouteContent />}
		</Show>
	);
}

function MediaRouteFallback() {
	return (
		<RouteDataPendingScreen
			description="メディア詳細を準備しています..."
			layout="media-detail"
			showDescription
			title="メディア詳細"
		/>
	);
}

function MediaRouteContent() {
	const routeData = Route.useLoaderData();
	const currentParams = Route.useParams();
	const mediaSourceId = () =>
		currentParams()?.mediaSourceId ?? routeData().mediaSourceId;
	const mediaId = () => currentParams()?.mediaId ?? routeData().mediaId;
	return (
		<ClientOnly fallback={<MediaRouteFallback />}>
			<MediaContent mediaId={mediaId} mediaSourceId={mediaSourceId} />
		</ClientOnly>
	);
}

function MediaContent(props: {
	mediaId: Accessor<string>;
	mediaSourceId: Accessor<string>;
}) {
	return (
		<MediaDetailScreen
			mediaDetailsQueryOptions={mediaDetailsQueryOptions}
			mediaId={props.mediaId}
			mediaSourceId={props.mediaSourceId}
			renderMediaSidebar={(media, isUpdating, onUpdate) => (
				<MediaSidebar
					isUpdating={isUpdating}
					media={media}
					onUpdate={onUpdate}
				/>
			)}
			renderMediaViewer={(media) => <MediaViewer media={media} />}
			transport={createServerTransport(props.mediaSourceId)}
		/>
	);
}
