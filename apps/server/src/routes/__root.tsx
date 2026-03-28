import { Toaster } from "@solid-imager/ui/toast";
import { type QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import {
	HeadContent,
	Outlet,
	Scripts,
	createRootRouteWithContext,
} from "@tanstack/solid-router";
import { HydrationScript } from "solid-js/web";
import { Suspense } from "solid-js";
import Nav from "~/components/nav";
import styleCss from "~/app.css?url";

interface RouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	head: () => ({
		links: [{ rel: "stylesheet", href: styleCss }],
	}),
	component: RootComponent,
});

function RootComponent() {
	const context = Route.useRouteContext();
	const queryClient = context().queryClient;

	return (
		<html lang="en">
			<head>
				<HydrationScript />
			</head>
			<body>
				<HeadContent />
				<QueryClientProvider client={queryClient}>
					<Suspense>
						<Nav />
						<Toaster />
						<Outlet />
					</Suspense>
				</QueryClientProvider>
				<Scripts />
			</body>
		</html>
	);
}