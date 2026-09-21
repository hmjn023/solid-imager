import { createFileRoute } from "@tanstack/solid-router";
import { RouteCompatibilityRedirect } from "~/components/route-compat";

export const Route = createFileRoute("/$")({
	component: RouteCompatibilityRedirect,
});
