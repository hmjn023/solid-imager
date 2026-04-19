import { AppShell } from "@solid-imager/ui/layouts/app-shell";
import { Toaster } from "@solid-imager/ui/toast";
import type { QueryClient } from "@tanstack/solid-query";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/solid-router";
import { Suspense } from "solid-js";
import { HydrationScript } from "solid-js/web";
import styleCss from "~/app.css?url";
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
				<Suspense>
					<AppShell nav={<Nav />}>
						<Outlet />
					</AppShell>
				</Suspense>
				<Scripts />
			</body>
		</html>
	);
}
