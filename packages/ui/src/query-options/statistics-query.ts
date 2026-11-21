import type {
	LibraryStatistics,
	StatisticsRequest,
	StatisticsSelection,
} from "@solid-imager/core/statistics";
import { queryOptions } from "@tanstack/solid-query";

export const STATISTICS_TIME_ZONE_COOKIE = "solid-imager.statistics-time-zone";

export function statisticsPeriod(selection: StatisticsSelection) {
	// Earlier drill-down URLs without a period used the recent window.
	return (
		selection.period ??
		(selection.bucket || selection.ipId || selection.characterId
			? "recent"
			: "all")
	);
}

export function statisticsQueryOptions(
	selection: StatisticsSelection,
	timeZone: string,
	load: (
		request: StatisticsRequest,
		signal: AbortSignal,
	) => Promise<LibraryStatistics>,
) {
	const input = { ...selection, period: statisticsPeriod(selection), timeZone };
	return queryOptions({
		queryKey: ["media", "statistics", input],
		queryFn: ({ signal }) => load(input, signal),
		staleTime: 30_000,
	});
}
