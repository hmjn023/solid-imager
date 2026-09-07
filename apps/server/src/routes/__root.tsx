import { RouteTransitionIndicator } from "@solid-imager/ui/router-status";
import { ShortcutPreferencesProvider } from "@solid-imager/ui/shortcuts/index";
import { Toaster } from "@solid-imager/ui/toast";
import type { QueryClient } from "@tanstack/solid-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/solid-router";
import { createSignal, onMount } from "solid-js";
import { HydrationScript } from "solid-js/web";
import styleCss from "~/app.css?url";
import { V2AppShell } from "~/components/v2/app-shell";

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
	onMount(() => {
		queueMicrotask(() => setIsHydrated(true));
	});

	return (
		<html data-hydrated={isHydrated() ? "true" : "false"} lang="ja">
			<head>
				<HydrationScript />
				<HeadContent />
			</head>
			<body class="v2-theme">
				<ShortcutPreferencesProvider>
					<Toaster />
					<V2AppShell statusIndicator={<RouteTransitionIndicator />}>
						<Outlet />
					</V2AppShell>
				</ShortcutPreferencesProvider>
				<script>
					{`if (typeof window !== "undefined") {
						let currentTsr;
						Object.defineProperty(window, "$_TSR", {
							configurable: true,
							get: () => currentTsr,
							set: (value) => {
								if (value && typeof value.e === "function") {
									const endStream = value.e.bind(value);
									value.e = () => {
										value.streamEnded = true;
										if (value.hydrated) endStream();
									};
								}
								currentTsr = value;
							},
						});
					}`}
				</script>
				<Scripts />
			</body>
		</html>
	);
}
