import { createFileRoute } from "@tanstack/solid-router";

// The parent renders the detail and keeps the collection's search context.
export const Route = createFileRoute("/pixiv/$postId")({
	component: () => null,
});
