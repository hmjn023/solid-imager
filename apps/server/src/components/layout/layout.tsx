import { RouteTransitionIndicator } from "@solid-imager/ui/router-status";
import { configQueryKeys } from "@solid-imager/ui/query-options";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { Outlet } from "@tanstack/solid-router";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { ApiActivityIndicator } from "~/components/api-activity-indicator";
import { useWorkspaceNavigation } from "~/presentation/workspace-navigation";
import { AppShell } from "./app-shell";

export function AppLayout() {
	const queryClient = useQueryClient();
	const workspace = useWorkspaceNavigation();
	const [context, setContext] = createSignal<WebMCP.ModelContext>();
	onMount(() => setContext(document.modelContext));
	const publication = createQuery(() => ({
		queryKey: [...configQueryKeys.all(), "webTools"],
		queryFn: ({ signal }) => orpc.config.webTools(undefined, { signal }),
		enabled: !!context(),
		refetchInterval: 30_000,
	}));
	createEffect(() => {
		const browser = context();
		const published = publication.data;
		if (!browser || !published) return;
		const registration = new AbortController();
		onCleanup(() => registration.abort());
		void import("~/infrastructure/mcp/web-tools")
			.then(({ registerWebTools }) =>
				registerWebTools(
					browser,
					published,
					queryClient,
					workspace,
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
