import { V2JobsScreen } from "@solid-imager/ui/screens/v2-jobs-screen";
import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/v2/jobs")({
	component: V2JobsRoute,
});

function V2JobsRoute() {
	return <V2JobsScreen />;
}
