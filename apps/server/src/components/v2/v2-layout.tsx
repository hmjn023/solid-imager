import { RouteTransitionIndicator } from "@solid-imager/ui/router-status";
import { Outlet } from "@tanstack/solid-router";
import { ApiActivityIndicator } from "~/components/api-activity-indicator";
import { V2AppShell } from "./v2-app-shell";

export function V2Layout() {
	return (
		<V2AppShell statusIndicator={<RouteTransitionIndicator />}>
			<ApiActivityIndicator />
			<Outlet />
		</V2AppShell>
	);
}
