import { RouteDataPendingScreen } from "@solid-imager/ui/router-status";
import { MediaDetailScreen } from "@solid-imager/ui/screens/media-detail-screen";
import { ClientOnly, createFileRoute, useParams } from "@tanstack/solid-router";
import { createSignal, onMount, Show } from "solid-js";
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

export const Route = createFileRoute("/sources/$mediaSourceId/$mediaId/")({
	ssr: true,
	loader: async ({ context, params }) => {
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
	const params = useParams({ from: "/sources/$mediaSourceId/$mediaId/" });
	const mediaSourceId = () => params().mediaSourceId;
	const mediaId = () => params().mediaId;
	return (
		<ClientOnly fallback={<MediaRouteFallback />}>
			<MediaContent mediaId={mediaId()} mediaSourceId={mediaSourceId()} />
		</ClientOnly>
	);
}

function MediaContent(props: { mediaId: string; mediaSourceId: string }) {
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
			transport={createServerTransport(() => props.mediaSourceId)}
		/>
	);
}
