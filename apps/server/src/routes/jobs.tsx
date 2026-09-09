import { createFileRoute } from "@tanstack/solid-router";
import { V2JobsPage } from "~/components/v2/v2-jobs-page";

export const Route = createFileRoute("/jobs")({
	ssr: false,
	pendingComponent: () => null,
	component: V2JobsPage,
});
