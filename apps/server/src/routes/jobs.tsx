import { createFileRoute } from "@tanstack/solid-router";
import { JobsPage } from "~/components/pages/jobs-page";

export const Route = createFileRoute("/jobs")({
	ssr: false,
	pendingComponent: () => null,
	component: JobsPage,
});
