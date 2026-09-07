import { createFileRoute } from "@tanstack/solid-router";
import { JobsRoute } from "~/components/jobs-route";

export const Route = createFileRoute("/jobs")({
	ssr: false,
	pendingComponent: () => null,
	component: JobsRoute,
});
