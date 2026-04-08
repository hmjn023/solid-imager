import { Toaster } from "@solid-imager/ui/toast";
import {
	createRootRouteWithContext,
	Link,
	Outlet,
} from "@tanstack/solid-router";
import type { AppRouterContext } from "../router";

export const Route = createRootRouteWithContext<AppRouterContext>()({
	component: RootRouteComponent,
});

function RootRouteComponent() {
	return (
		<div class="min-h-screen bg-background text-foreground">
			<Toaster />
			<header class="border-border border-b bg-card/90 backdrop-blur">
				<div class="container flex items-center justify-between py-4">
					<div>
						<p class="font-semibold text-lg">Solid Imager</p>
						<p class="text-muted-foreground text-sm">Standalone Tauri SPA</p>
					</div>
					<nav class="flex items-center gap-4 text-sm">
						<Link
							activeProps={{ class: "text-foreground" }}
							class="text-muted-foreground transition-colors hover:text-foreground"
							to="/"
						>
							Home
						</Link>
					</nav>
				</div>
			</header>
			<main class="container py-10">
				<Outlet />
			</main>
		</div>
	);
}
