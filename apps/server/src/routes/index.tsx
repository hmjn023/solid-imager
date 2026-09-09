import { createFileRoute } from "@tanstack/solid-router";
import { SearchCompatibilityRedirect } from "~/components/v2/v2-route-compat";

export const Route = createFileRoute("/")({
	component: SearchCompatibilityRedirect,
});
