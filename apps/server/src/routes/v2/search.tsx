import { createFileRoute } from "@tanstack/solid-router";
import { V2CompatibilityRedirect } from "~/components/v2/v2-route-compat";

export const Route = createFileRoute("/v2/search")({
	pendingComponent: () => null,
	component: V2CompatibilityRedirect,
});
