import { createFileRoute } from "@tanstack/solid-router";
import { V2NotFoundRoute } from "~/components/v2/v2-not-found";

export const Route = createFileRoute("/$")({
	component: V2NotFoundRoute,
});
