import { t } from "@solid-imager/i18n";
import type {
	LibraryStatistics,
	StatisticsRequest,
	StatisticsSelection,
} from "@solid-imager/core/statistics";
import { createQuery } from "@tanstack/solid-query";
import { Link, useLocation } from "@tanstack/solid-router";
import { createSignal, For, Match, Show, Switch } from "solid-js";
import { EmptyState, ErrorState, OfflineState } from "../async-state";
import { Button } from "../button";
import { Card } from "../card";
import { saveMediaContext } from "../media-context";
import { ManagementHeader } from "../workspace/management-layout";

import {
	ImportTrend,
	MediaComposition,
	ModelFavorites,
	Ranking,
} from "./statistics/charts";

export function StatisticsScreen(props: {
	selection: StatisticsSelection;
	change: (selection: StatisticsSelection) => void;
	load: (
		request: StatisticsRequest,
		signal: AbortSignal,
	) => Promise<LibraryStatistics>;
}) {
	const location = useLocation();
	const [cumulative, setCumulative] = createSignal(false);
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const isFiltered = () =>
		Boolean(
			props.selection.bucket ||
			props.selection.ipId ||
			props.selection.characterId,
		);
	// Earlier drill-down URLs without a period used the recent window.
	const period = () =>
		props.selection.period ?? (isFiltered() ? "recent" : "all");
	const query = createQuery(() => {
		const input = { ...props.selection, period: period(), timeZone };
		return {
			queryKey: ["media", "statistics", input],
			queryFn: ({ signal }) => props.load(input, signal),
		};
	});
	const recent = () => period() === "recent";
	const periodLabel = () => {
		const bucket = props.selection.bucket;
		if (bucket) return recent() ? bucket : bucket.slice(0, 7);
		return recent()
			? t("statisticsScreen.last30Days")
			: t("statisticsScreen.allTime");
	};
	const setBucket = (bucket: string) =>
		props.change({
			period: period(),
			bucket: bucket === props.selection.bucket ? undefined : bucket,
		});
	const setIp = (ipId: string) =>
		props.change({
			period: period(),
			bucket: props.selection.bucket,
			ipId: ipId === props.selection.ipId ? undefined : ipId,
		});
	const setCharacter = (id: string) =>
		props.change({
			...props.selection,
			period: period(),
			page: undefined,
			characterId: props.selection.characterId === id ? undefined : id,
		});
	const page = () => props.selection.page ?? 0;
	const retry = () => {
		void query.refetch();
	};
	return (
		<section class="flex h-full min-h-0 min-w-0 flex-col">
			<ManagementHeader
				title={t("statisticsScreen.libraryStatistics")}
				eyebrow={t("statisticsScreen.collection")}
				description={t(
					"statisticsScreen.reviewImportTrendsAndBreakdownsSelectADateOr",
				)}
				actions={
					<fieldset
						class="flex gap-0.5 rounded-lg border border-border bg-muted p-1"
						aria-label={t("statisticsScreen.reportingPeriod")}
					>
						<Button
							class="h-11 px-3 sm:h-8"
							variant={recent() ? "default" : "ghost"}
							aria-pressed={recent()}
							onClick={() => props.change({ period: "recent" })}
						>
							{t("statisticsScreen.last30Days")}
						</Button>
						<Button
							class="h-11 px-3 sm:h-8"
							variant={recent() ? "ghost" : "default"}
							aria-pressed={!recent()}
							onClick={() => props.change({ period: "all" })}
						>
							{t("statisticsScreen.allTime")}
						</Button>
					</fieldset>
				}
			/>
			<div class="@container min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-background p-3 scrollbar-stable sm:p-5">
				<Switch>
					<Match when={query.data}>
						{(data) => (
							<>
								<div class="grid items-stretch gap-4 @3xl:grid-cols-3">
									<div class="grid min-w-0 @3xl:col-span-2">
										<Show
											when={data().trend.some((item) => item.cumulative > 0)}
											fallback={
												<EmptyState
													title={t("statisticsScreen.noImportsInThisPeriod")}
												/>
											}
										>
											<ImportTrend
												trend={data().trend}
												monthly={!recent()}
												cumulative={cumulative()}
												onCumulative={setCumulative}
												selected={props.selection.bucket}
												select={setBucket}
											/>
										</Show>
									</div>
									<MediaComposition
										items={data().mediaTypes}
										filtered={isFiltered()}
									/>
								</div>
								<Show when={isFiltered()}>
									<div
										class="flex flex-wrap items-center gap-2 text-sm"
										aria-live="polite"
									>
										<strong>{t("statisticsScreen.filtered")}</strong>
										<Show when={props.selection.bucket}>
											{(value) => (
												<span>{recent() ? value() : value().slice(0, 7)}</span>
											)}
										</Show>
										<Show when={props.selection.ipId}>
											<span>
												{data().ips.find((ip) => ip.id === props.selection.ipId)
													?.name ?? t("statisticsScreen.selectedIP")}
											</span>
										</Show>
										<Show when={props.selection.characterId}>
											<span>
												{data().characters.find(
													(c) => c.id === props.selection.characterId,
												)?.name ?? t("statisticsScreen.selectedCharacter")}
											</span>
										</Show>
										<Button
											variant="outline"
											onClick={() => props.change({ period: period() })}
										>
											{t("statisticsScreen.clearFilter")}
										</Button>
									</div>
								</Show>
								<div class="grid gap-4 @3xl:grid-cols-2">
									<Ranking
										kind="ip"
										periodLabel={periodLabel()}
										items={data().ips}
										selected={props.selection.ipId}
										select={setIp}
									/>
									<Ranking
										kind="character"
										periodLabel={periodLabel()}
										items={data().characters}
										selected={props.selection.characterId}
										select={setCharacter}
									/>
								</div>
								<ModelFavorites models={data().models} />
								<Show when={isFiltered()}>
									<Card class="p-4">
										<h2 class="mb-2 font-semibold">
											{t("statisticsScreen.matchingMedia")}
										</h2>
										<ul class="divide-y divide-border text-sm">
											<For
												each={data().media}
												fallback={
													<li>{t("statisticsScreen.noMatchingMedia")}</li>
												}
											>
												{(item) => (
													<li>
														<Link
															class="block break-all py-2 text-primary hover:underline"
															to="/sources/$mediaSourceId/$mediaId"
															params={{
																mediaSourceId: item.mediaSourceId,
																mediaId: item.id,
															}}
															onClick={() =>
																saveMediaContext(location().href, data().media)
															}
														>
															{item.fileName}
														</Link>
													</li>
												)}
											</For>
										</ul>
										<Show when={page() > 0 || data().hasMore}>
											<div class="mt-2 flex gap-2">
												<Button
													variant="outline"
													disabled={!page()}
													onClick={() =>
														props.change({
															...props.selection,
															page: page() - 1,
														})
													}
												>
													{t("actions.previous")}
												</Button>
												<Button
													variant="outline"
													disabled={!data().hasMore}
													onClick={() =>
														props.change({
															...props.selection,
															page: page() + 1,
														})
													}
												>
													{t("actions.next")}
												</Button>
											</div>
										</Show>
									</Card>
								</Show>
							</>
						)}
					</Match>
					<Match when={query.fetchStatus === "paused"}>
						<OfflineState onRetry={retry} />
					</Match>
					<Match when={query.isError}>
						<ErrorState
							title={t("statisticsScreen.couldNotLoadStatistics")}
							onRetry={retry}
						/>
					</Match>
					<Match when={query.isPending}>
						<output>{t("statisticsScreen.loadingStatistics")}</output>
					</Match>
				</Switch>
			</div>
		</section>
	);
}
