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
import { V2Layout } from "~/components/v2/v2-layout";

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
	const isStandaloneRoute = () => {
		const pathname = location().pathname;
		return (
			pathname === "/design-lab" ||
			pathname.startsWith("/design-lab/") ||
			pathname === "/docs/swagger" ||
			pathname.startsWith("/docs/swagger/")
		);
	};
	onMount(() => {
		setIsHydrated(true);
	});

	return (
		<html data-hydrated={isHydrated() ? "true" : "false"} lang="ja">
			<head>
				<HydrationScript />
				<HeadContent />
			</head>
			<body classList={{ "v2-theme": !isStandaloneRoute() }}>
				<ShortcutPreferencesProvider>
					<Toaster />
					<Show fallback={<Outlet />} when={!isStandaloneRoute()}>
						<Show fallback={null} when={isHydrated()}>
							<V2Layout />
						</Show>
					</Show>
				</ShortcutPreferencesProvider>
				<Scripts />
			</body>
		</html>
	);
}
