import { Toaster } from "@solid-imager/ui/toast";
import type { QueryClient } from "@tanstack/solid-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/solid-router";
import { Suspense } from "solid-js";
import { HydrationScript } from "solid-js/web";
import styleCss from "~/app.css?url";
import Nav from "~/components/nav";
import { runtimeCapabilities } from "~/infrastructure/app-client";

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
				{!__TAURI_BUILD__ && <HydrationScript />}
				<HeadContent />
			</head>
			<body>
				<Toaster />
				<Suspense>
					{runtimeCapabilities.supportsRpcBackend ? (
						<>
							<Nav />
							<Outlet />
						</>
					) : (
						<main class="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6 py-16">
							<h1 class="font-bold text-3xl">Desktop Runtime Not Ready</h1>
							<p class="text-muted-foreground">
								This Tauri build no longer falls through to the web RPC layer.
								Local runtime wiring is still missing, so the desktop app is
								intentionally blocked instead of failing at runtime.
							</p>
							<p class="text-muted-foreground">
								Planned next steps are local persistence, AppClient-backed
								operations, and capability-aware feature enablement.
							</p>
						</main>
					)}
				</Suspense>
				<Scripts />
			</body>
		</html>
	);
}
