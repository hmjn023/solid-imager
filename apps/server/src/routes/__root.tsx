import { AppShell } from "@solid-imager/ui/layouts/app-shell";
import { RouteTransitionIndicator } from "@solid-imager/ui/router-status";
import { ShortcutPreferencesProvider } from "@solid-imager/ui/shortcuts/index";
import { Toaster } from "@solid-imager/ui/toast";
import type { QueryClient } from "@tanstack/solid-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	useLocation,
} from "@tanstack/solid-router";
import { createSignal, onMount, Show } from "solid-js";
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
	const [isHydrated, setIsHydrated] = createSignal(false);
	const location = useLocation();
	const isV2Route = () =>
		location().pathname === "/v2" || location().pathname.startsWith("/v2/");
	onMount(() => {
		setIsHydrated(true);
	});

	return (
		<html data-hydrated={isHydrated() ? "true" : "false"} lang="ja">
			<head>
				<HydrationScript />
				<HeadContent />
			</head>
			<body classList={{ "v2-theme": isV2Route() }}>
				<ShortcutPreferencesProvider>
					<Toaster />
					<Show
						fallback={<Outlet />}
						when={
							location().pathname !== "/design-lab" &&
							!location().pathname.startsWith("/design-lab/") &&
							!isV2Route()
						}
					>
						<AppShell
							nav={<Nav />}
							statusIndicator={<RouteTransitionIndicator />}
						>
							<ApiActivityIndicator />
							<Outlet />
						</AppShell>
					</Show>
				</ShortcutPreferencesProvider>
				<Scripts />
			</body>
		</html>
	);
}
