import { createFileRoute } from "@tanstack/solid-router";

// The parent renders the detail and keeps the collection's search context.
export const Route = createFileRoute("/danbooru/$postId")({
	component: () => null,
});
