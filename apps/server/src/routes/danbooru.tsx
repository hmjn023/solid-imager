import { createFileRoute, lazyRouteComponent } from "@tanstack/solid-router";

export const Route = createFileRoute("/danbooru")({
	ssr: false,
	pendingComponent: () => null,
	component: lazyRouteComponent(
		() => import("~/components/pages/danbooru-page"),
		"DanbooruPage",
	),
});
