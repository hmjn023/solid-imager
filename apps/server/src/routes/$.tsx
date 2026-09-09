import { createFileRoute } from "@tanstack/solid-router";
import { LegacyRouteRedirect } from "~/components/route-compat";

export const Route = createFileRoute("/$")({
	component: LegacyRouteRedirect,
});
