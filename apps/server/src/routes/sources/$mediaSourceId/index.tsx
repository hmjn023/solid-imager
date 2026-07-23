import { RouteDataPendingScreen } from "@solid-imager/ui/router-status";
import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, onMount, Show } from "solid-js";
import {
	allAuthorsQueryOptions,
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	tagsQueryOptions,
} from "~/infrastructure/api-clients/queries";
import type { RouteLoaderContext } from "~/infrastructure/router/route-types";
import { SourceMediaPage } from "./components/source-media-page";

export const Route = createFileRoute("/sources/$mediaSourceId/")({
	ssr: true,
	loader: async ({ context }: RouteLoaderContext) => {
		await Promise.all([
			context.queryClient.prefetchQuery(tagsQueryOptions()),
			context.queryClient.prefetchQuery(allProjectsQueryOptions()),
			context.queryClient.prefetchQuery(allIpsQueryOptions()),
			context.queryClient.prefetchQuery(allCharactersQueryOptions()),
			context.queryClient.prefetchQuery(allAuthorsQueryOptions()),
		]);
	},
	pendingComponent: SourceMediaRouteFallback,
	pendingMinMs: 0,
	component: SourceMediaRoute,
});

function SourceMediaRouteFallback() {
	return (
		<RouteDataPendingScreen
			description="メディア一覧を準備しています..."
			layout="media-grid"
			showAction
			title="メディア一覧"
		/>
	);
}

function SourceMediaRoute() {
	const [isMounted, setIsMounted] = createSignal(false);

	onMount(() => {
		setIsMounted(true);
	});

	return (
		<Show fallback={<SourceMediaRouteFallback />} when={isMounted()}>
			{(_mounted) => <SourceMediaPage />}
		</Show>
	);
}
