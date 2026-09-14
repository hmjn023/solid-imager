import { createFileRoute } from "@tanstack/solid-router";
import { SearchCompatibilityRedirect } from "~/components/route-compat";

export const Route = createFileRoute("/")({
	component: SearchCompatibilityRedirect,
});
