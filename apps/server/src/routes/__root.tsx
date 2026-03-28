import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/solid-router";
import { QueryClient } from "@tanstack/solid-query";
import { HydrationScript } from "solid-js/web";
import { Suspense } from "solid-js";
import Nav from "~/components/nav";
import { Toaster } from "@solid-imager/ui/toast";
import styleCss from "~/app.css?url";

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
				<Suspense>
					<Nav />
					<Toaster />
					<Outlet />
				</Suspense>
				<Scripts />
			</body>
		</html>
	);
}
