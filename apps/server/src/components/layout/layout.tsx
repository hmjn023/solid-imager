import { RouteTransitionIndicator } from "@solid-imager/ui/router-status";
import { useQueryClient } from "@tanstack/solid-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/solid-router";
import { onCleanup, onMount } from "solid-js";
import { ApiActivityIndicator } from "~/components/api-activity-indicator";
import { AppShell } from "./app-shell";

export function AppLayout() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const location = useLocation();
	onMount(() => {
		const context = document.modelContext;
		if (!context) return;
		const registration = new AbortController();
		onCleanup(() => registration.abort());
		void import("~/infrastructure/mcp/web-tools")
			.then(({ registerWebTools }) =>
				registerWebTools(
					context,
					queryClient,
					{
						pathname: () => location().pathname,
						openSearch: (id) =>
							navigate({ to: "/search", search: { search: id } }),
						openMedia: (sourceId, mediaId) =>
							navigate({
								to: "/sources/$mediaSourceId/$mediaId",
								params: { mediaSourceId: sourceId, mediaId },
							}),
					},
					registration.signal,
				),
			)
			.catch((error: unknown) => {
				if (registration.signal.aborted) return;
				registration.abort();
				console.warn("Could not register Solid Imager WebMCP tools", error);
			});
	});
	return (
		<AppShell statusIndicator={<RouteTransitionIndicator />}>
			<ApiActivityIndicator />
			<Outlet />
		</AppShell>
	);
}
