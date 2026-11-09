import { createFileRoute } from "@tanstack/solid-router";

// The parent keeps the collection mounted while the URL identifies the open post.
export const Route = createFileRoute("/danbooru/$postId")({
	component: () => null,
});
