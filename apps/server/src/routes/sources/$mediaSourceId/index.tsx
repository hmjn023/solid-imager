import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, onMount, Show } from "solid-js";
import { SourceMediaPage } from "./components/source-media-page";

export const Route = createFileRoute("/sources/$mediaSourceId/")({
	ssr: false,
	pendingComponent: () => null,
	component: SourceMediaRoute,
});

function SourceMediaRouteFallback() {
	return null;
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
