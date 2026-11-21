import {
	statisticsRequestSchema,
	statisticsSelectionSchema,
	type StatisticsRequest,
	type StatisticsSelection,
} from "@solid-imager/core/statistics";
import {
	STATISTICS_TIME_ZONE_COOKIE,
	StatisticsScreen,
	statisticsQueryOptions,
} from "@solid-imager/ui/screens/statistics";
import type { JSX } from "solid-js";
import { isServer } from "solid-js/web";
import { createFileRoute, useLoaderData } from "@tanstack/solid-router";
import { createServerOnlyFn } from "@tanstack/solid-start";
import { getCookie } from "@tanstack/solid-start/server";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import type { RouteLoaderContext } from "~/infrastructure/router/route-types";

const load = (request: StatisticsRequest, signal: AbortSignal) =>
	orpc.media.statistics(request, { signal });

const readTimeZone = createServerOnlyFn(() => {
	const result = statisticsRequestSchema.shape.timeZone.safeParse(
		getCookie(STATISTICS_TIME_ZONE_COOKIE),
	);
	return result.success ? result.data : "UTC";
});

export const Route = createFileRoute("/statistics")({
	validateSearch: statisticsSelectionSchema,
	loaderDeps: ({ search }: { search: StatisticsSelection }) => search,
	loader: async ({
		context,
		deps,
	}: RouteLoaderContext & { deps: StatisticsSelection }) => {
		if (!isServer) return;
		const timeZone = readTimeZone();
		const options = statisticsQueryOptions(deps, timeZone, load);
		await context.queryClient.query(options).catch(() => {
			context.queryClient.removeQueries({
				queryKey: options.queryKey,
				exact: true,
			});
		});
		return timeZone;
	},
	component: StatisticsPage,
});

function StatisticsPage(): JSX.Element {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const timeZone = useLoaderData({ from: "/statistics" });
	return (
		<StatisticsScreen
			selection={search()}
			change={(selection) => void navigate({ search: selection })}
			initialTimeZone={timeZone()}
			onTimeZoneResolved={(zone) => {
				document.cookie = `${STATISTICS_TIME_ZONE_COOKIE}=${encodeURIComponent(zone)}; Path=/; Max-Age=31536000; SameSite=Lax`;
			}}
			load={load}
		/>
	);
}
