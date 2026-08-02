import { RouteTransitionIndicator } from "@solid-imager/ui/router-status";
import { createFileRoute, Outlet } from "@tanstack/solid-router";
import { createSignal, onMount, Show } from "solid-js";
import { ApiActivityIndicator } from "~/components/api-activity-indicator";
import { V2AppShell } from "~/components/v2/v2-app-shell";

export const Route = createFileRoute("/v2")({
	pendingComponent: () => null,
	component: V2Layout,
});

function V2Layout() {
	const [isMounted, setIsMounted] = createSignal(false);
	onMount(() => setIsMounted(true));

	return (
		<Show when={isMounted()}>
			<V2AppShell statusIndicator={<RouteTransitionIndicator />}>
				<ApiActivityIndicator />
				<Outlet />
			</V2AppShell>
		</Show>
	);
}
