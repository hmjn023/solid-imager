import { createFileRoute } from "@tanstack/solid-router";
import { loadInitialViewerPost } from "~/infrastructure/api-clients/load-initial-viewer";

// The parent renders the detail and keeps the collection's search context.
export const Route = createFileRoute("/pixiv/$postId")({
	component: () => null,
	loader: loadInitialViewerPost("pixiv"),
});
