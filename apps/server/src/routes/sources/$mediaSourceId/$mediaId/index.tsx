import { MediaDetailScreen } from "@solid-imager/ui/screens/media-detail-screen";
import { ClientOnly, createFileRoute, useParams } from "@tanstack/solid-router";
import { createSignal, onMount, Show } from "solid-js";
import { MediaSidebar } from "~/components/media/media-sidebar";
import { MediaViewer } from "~/components/media/media-viewer";
import { createServerTransport } from "~/hooks/use-media-source-events";
import { mediaDetailsQueryOptions } from "~/infrastructure/api-clients/queries";

export const Route = createFileRoute("/sources/$mediaSourceId/$mediaId/")({
	// The detail data remains client-fetched, but render a server-safe static
	// fallback so direct navigation never starts with an empty page.
	ssr: true,
	pendingComponent: MediaRouteFallback,
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
		<main class="container mx-auto p-4">
			<section
				aria-live="polite"
				class="flex min-h-48 flex-col items-center justify-center gap-2 text-muted-foreground"
				role="status"
			>
				<h1 class="font-bold text-2xl text-foreground">メディア詳細</h1>
				<p>メディア詳細を準備しています...</p>
			</section>
		</main>
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
