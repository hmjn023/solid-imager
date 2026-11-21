import { createFileRoute } from "@tanstack/solid-router";
import { PixivPage } from "~/components/pages/pixiv-page";
import { loadInitialViewer } from "~/infrastructure/api-clients/load-initial-viewer";

export const Route = createFileRoute("/pixiv")({
	component: PixivPage,
	loader: loadInitialViewer("pixiv"),
});
