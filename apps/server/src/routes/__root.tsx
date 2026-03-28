import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/solid-router";
import Nav from "~/components/nav";
import { Toaster } from "@solid-imager/ui/toast";
import styleCss from "~/app.css?url";

export const Route = createRootRoute({
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
	component: RootComponent,
});

function RootComponent() {
	return (
		<html lang="ja">
			<head>
				<HeadContent />
			</head>
			<body>
				<Nav />
				<Toaster />
				<Outlet />
				<Scripts />
			</body>
		</html>
	);
}
