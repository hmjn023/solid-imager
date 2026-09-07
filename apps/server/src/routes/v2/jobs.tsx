import { createFileRoute } from "@tanstack/solid-router";
import { V2JobsRoute } from "~/components/v2/jobs-route";

export const Route = createFileRoute("/v2/jobs")({
	ssr: false,
	pendingComponent: () => null,
	component: V2JobsRoute,
});
