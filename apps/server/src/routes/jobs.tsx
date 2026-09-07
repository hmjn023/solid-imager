import { createFileRoute } from "@tanstack/solid-router";
import { V2JobsRoute } from "~/components/jobs-route";

export const Route = createFileRoute("/jobs")({
	ssr: false,
	pendingComponent: () => null,
	component: V2JobsRoute,
});
