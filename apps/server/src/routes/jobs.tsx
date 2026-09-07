import { createFileRoute } from "@tanstack/solid-router";
import { V2JobsRoute } from "~/components/v2/v2-jobs-route";

export const Route = createFileRoute("/jobs")({
	ssr: false,
	pendingComponent: () => null,
	component: V2JobsRoute,
});
