import { createFileRoute, useParams } from "@tanstack/solid-router";
import { createMemo, Show } from "solid-js";
import { MediaSidebar } from "../../../../components/media/media-sidebar";
import { MediaViewer } from "../../../../components/media/media-viewer";
import { getMockMedia } from "../../../../mocks/demo-data";

export const Route = createFileRoute("/sources/$mediaSourceId/$mediaId/")({
	component: MediaDetailRoute,
});

function MediaDetailRoute() {
	const params = useParams({ from: "/sources/$mediaSourceId/$mediaId/" });
	const mediaDetails = createMemo(() => getMockMedia(params().mediaId));

	return (
		<div class="container mx-auto p-4">
			<Show
				fallback={
					<div class="text-red-500">Error: mock media was not found.</div>
				}
				when={mediaDetails()}
			>
				{(details) => (
					<div class="flex h-[calc(100vh-80px)] flex-col gap-4 lg:flex-row">
						<div class="flex-grow">
							<MediaViewer media={details()} />
						</div>
						<div class="w-full shrink-0 lg:w-96">
							<MediaSidebar media={details()} />
						</div>
					</div>
				)}
			</Show>
		</div>
	);
}
