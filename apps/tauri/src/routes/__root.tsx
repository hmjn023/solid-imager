import { AppShell } from "@solid-imager/ui/layouts/app-shell";
import { Toaster } from "@solid-imager/ui/toast";
import {
	HeadContent,
	Outlet,
	Scripts,
	createRootRouteWithContext,
} from "@tanstack/solid-router";
import { Suspense } from "solid-js";
import { Nav } from "~/components/nav";
import type { AppRouterContext } from "~/router";
import styleCss from "~/app.css?url";

export const Route = createRootRouteWithContext<AppRouterContext>()({
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
	component: RootRouteComponent,
});

function RootRouteComponent() {
	return (
		<html lang="ja">
			<head>
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
