import { createRootRouteWithContext, Outlet } from "@tanstack/solid-router";
import { TauriAppShell } from "~/components/app-shell";
import type { AppRouterContext } from "~/router";

export const Route = createRootRouteWithContext<AppRouterContext>()({
	component: RootRouteComponent,
});

function RootRouteComponent() {
	return (
		<TauriAppShell>
			<Outlet />
		</TauriAppShell>
	);
}
