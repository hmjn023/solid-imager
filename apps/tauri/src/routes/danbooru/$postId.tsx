import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/danbooru/$postId")({
	component: () => null,
});
