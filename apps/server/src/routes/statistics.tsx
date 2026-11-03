import { statisticsSelectionSchema } from "@solid-imager/core/statistics";
import { StatisticsScreen } from "@solid-imager/ui/screens/statistics";
import type { JSX } from "solid-js";
import { createFileRoute } from "@tanstack/solid-router";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

export const Route = createFileRoute("/statistics")({
	ssr: false,
	pendingComponent: () => null,
	validateSearch: statisticsSelectionSchema,
	component: StatisticsPage,
});

function StatisticsPage(): JSX.Element {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<StatisticsScreen
			selection={search()}
			change={(selection) => void navigate({ search: selection })}
			load={(request, signal) => orpc.media.statistics(request, { signal })}
		/>
	);
}
