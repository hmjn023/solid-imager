import { AppShell } from "@solid-imager/ui/layouts/app-shell";
import { RouteTransitionIndicator } from "@solid-imager/ui/router-status";
import { Toaster } from "@solid-imager/ui/toast";
import { createRootRouteWithContext, Outlet } from "@tanstack/solid-router";
import { Nav } from "~/components/nav";
import type { AppRouterContext } from "~/router";

export const Route = createRootRouteWithContext<AppRouterContext>()({
	component: RootRouteComponent,
});

function RootRouteComponent() {
	return (
		<>
			<Toaster />
			<AppShell nav={<Nav />} statusIndicator={<RouteTransitionIndicator />}>
				<Outlet />
			</AppShell>
		</>
	);
}
