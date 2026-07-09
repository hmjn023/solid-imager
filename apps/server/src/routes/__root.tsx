import { AppShell } from "@solid-imager/ui/layouts/app-shell";
import { RouteTransitionIndicator } from "@solid-imager/ui/router-status";
import { Toaster } from "@solid-imager/ui/toast";
import type { QueryClient } from "@tanstack/solid-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/solid-router";
import { HydrationScript } from "solid-js/web";
import styleCss from "~/app.css?url";
import { ApiActivityIndicator } from "~/components/api-activity-indicator";
import Nav from "~/components/nav";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Solid Imager",
			},
		],
		links: [{ rel: "stylesheet", href: styleCss }],
	}),
	shellComponent: RootComponent,
});

function RootComponent() {
	return (
		<html lang="ja">
			<head>
				<HydrationScript />
				<HeadContent />
			</head>
			<body>
				<Toaster />
				<AppShell nav={<Nav />} statusIndicator={<RouteTransitionIndicator />}>
					<ApiActivityIndicator />
					<Outlet />
				</AppShell>
				<Scripts />
			</body>
		</html>
	);
}
