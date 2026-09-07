import { createRootRouteWithContext, Outlet } from "@tanstack/solid-router";
import { TauriV2AppShell } from "~/components/v2-app-shell";
import type { AppRouterContext } from "~/router";

export const Route = createRootRouteWithContext<AppRouterContext>()({
	component: RootRouteComponent,
});

function RootRouteComponent() {
	return (
		<TauriV2AppShell>
			<Outlet />
		</TauriV2AppShell>
	);
}
