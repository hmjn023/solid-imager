import type { JSX } from "solid-js";
import {
	createFileRoute,
	useSearch,
	useNavigate,
} from "@tanstack/solid-router";
import { JobsPage } from "~/components/pages/jobs-page";
import {
	jobsSearchSchema,
	type JobsView,
} from "@solid-imager/ui/screens/jobs-view";

export const Route = createFileRoute("/jobs")({
	ssr: false,
	validateSearch: jobsSearchSchema,
	pendingComponent: () => null,
	component: JobsRoute,
});

function JobsRoute(): JSX.Element {
	const view = useSearch({
		strict: false,
		select: (search: unknown) => jobsSearchSchema.parse(search).view,
	});
	const navigate: (options: {
		to: "/jobs";
		search: { view: JobsView };
		replace: boolean;
	}) => Promise<void> = useNavigate({ from: "/jobs" });
	return (
		<JobsPage
			view={view}
			onViewChange={(view) => {
				void navigate({ to: "/jobs", search: { view }, replace: true });
			}}
		/>
	);
}
