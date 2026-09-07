import { createFileRoute } from "@tanstack/solid-router";
import { V2AboutRoute } from "./v2/about";

export const Route = createFileRoute("/about")({
	component: V2AboutRoute,
});
