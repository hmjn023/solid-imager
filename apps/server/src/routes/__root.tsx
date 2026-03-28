import { Toaster } from "@solid-imager/ui/toast";
import { type QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/solid-router";
import { Suspense } from "solid-js";
import { HydrationScript } from "solid-js/web";
import Nav from "~/components/nav";
import "~/app.css";

interface RouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	head: () => ({
		meta: [
			{
				charset: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Solid Imager",
			},
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.ico",
			},
		],
	}),
	shellComponent: RootComponent,
});

function RootComponent() {
	const context = Route.useRouteContext();
	const queryClient = context().queryClient;

	return (
		<html lang="en">
			<head>
				<HydrationScript />
				<HeadContent />
			</head>
			<body>
				<QueryClientProvider client={queryClient}>
					<Nav />
					<Toaster />
					<Suspense>
						<Outlet />
					</Suspense>
				</QueryClientProvider>
				<Scripts />
			</body>
		</html>
	);
}
