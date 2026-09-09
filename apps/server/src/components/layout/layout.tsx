import { RouteTransitionIndicator } from "@solid-imager/ui/router-status";
import { Outlet } from "@tanstack/solid-router";
import { ApiActivityIndicator } from "~/components/api-activity-indicator";
import { AppShell } from "./app-shell";

export function AppLayout() {
	return (
		<AppShell statusIndicator={<RouteTransitionIndicator />}>
			<ApiActivityIndicator />
			<Outlet />
		</AppShell>
	);
}
