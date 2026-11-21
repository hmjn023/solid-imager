import { createFileRoute } from "@tanstack/solid-router";
import { DanbooruPage } from "~/components/pages/danbooru-page";
import { loadInitialViewer } from "~/infrastructure/api-clients/load-initial-viewer";

export const Route = createFileRoute("/danbooru")({
	component: DanbooruPage,
	loader: loadInitialViewer("danbooru"),
});
