import { createFileRoute, lazyRouteComponent } from "@tanstack/solid-router";

export const Route = createFileRoute("/pixiv")({
	ssr: false,
	pendingComponent: () => null,
	component: lazyRouteComponent(
		() => import("~/components/pages/pixiv-page"),
		"PixivPage",
	),
});
