import { createFileRoute } from "@tanstack/solid-router";
import { jobSelectionSearchSchema } from "@solid-imager/ui/screens/jobs-selection";
import { JobsPage } from "~/components/pages/jobs-page";

export const Route = createFileRoute("/jobs")({
	ssr: false,
	validateSearch: jobSelectionSearchSchema,
	pendingComponent: () => null,
	component: JobsPage,
});
