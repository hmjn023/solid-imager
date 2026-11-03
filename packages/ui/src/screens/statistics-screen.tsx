import type {
	LibraryStatistics,
	StatisticsRequest,
	StatisticsSelection,
} from "@solid-imager/core/domain/media/statistics";
import { barY, defineChart } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { Chart } from "@tanstack/charts/solid";
import { tooltip } from "@tanstack/charts/tooltip";
import { createQuery } from "@tanstack/solid-query";
import { Link, useLocation } from "@tanstack/solid-router";
import { createMemo, For, Match, Show, Switch } from "solid-js";
import { EmptyState, ErrorState, OfflineState } from "../async-state";
import { Button } from "../button";
import { Card } from "../card";
import { saveMediaContext } from "../media-context";
import { ManagementHeader } from "../workspace/management-layout";

function ImportTrend(props: {
	trend: LibraryStatistics["trend"];
	monthly: boolean;
	selected?: string;
	select: (bucket: string) => void;
}) {
	const label = (bucket: string) =>
		props.monthly ? bucket.slice(0, 7) : bucket;
	const chart = createMemo(() =>
		defineChart({
			marks: [
				barY(props.trend, {
					x: "bucket",
					y: "count",
					fill: "hsl(var(--primary))",
					maxThickness: 48,
				}),
			],
			scales: {
				x: {
					scale: () => scaleBand<string>().padding(0.12),
					axis: {
						ticks: {
							format: (value) =>
								props.monthly ? value.slice(0, 7) : value.slice(5),
						},
						tickLabels: { thin: true },
					},
				},
				y: {
					scale: scaleLinear,
					nice: true,
					grid: true,
					axis: {
						ticks: {
							format: (count) => (Number.isInteger(count) ? String(count) : ""),
						},
					},
				},
			},
			tooltip,
		}),
	);
	return (
		<Card class="min-w-0 p-4">
			<h2 class="font-semibold">取り込み推移</h2>
			<p class="text-sm text-muted-foreground">
				{props.monthly ? "月別" : "日別"} · 計{" "}
				{props.trend
					.reduce((sum, item) => sum + item.count, 0)
					.toLocaleString()}{" "}
				件
			</p>
			<Chart
				ariaLabel="メディアの取り込み件数"
				definition={chart()}
				height={220}
				onSelect={(point) => {
					if (point) props.select(point.datum.bucket);
				}}
			/>
			<details class="text-sm">
				<summary class="cursor-pointer text-muted-foreground">
					件数を一覧で見る
				</summary>
				<ul class="mt-2 grid gap-1 sm:grid-cols-3 lg:grid-cols-5">
					<For each={props.trend}>
						{(item) => (
							<li>
								<Button
									class="w-full justify-between"
									variant="ghost"
									aria-pressed={props.selected === item.bucket}
									onClick={() => props.select(item.bucket)}
								>
									{label(item.bucket)} <span>{item.count} 件</span>
								</Button>
							</li>
						)}
					</For>
				</ul>
			</details>
		</Card>
	);
}

function Ranking(props: {
	title: string;
	items: LibraryStatistics["ips"];
	selected?: string;
	select: (id: string) => void;
}) {
	return (
		<Card class="min-w-0 p-4">
			<h2 class="font-semibold">{props.title}</h2>
			<p class="mb-2 text-sm text-muted-foreground">メディア件数の上位10件</p>
			<ol class="space-y-1">
				<For
					each={props.items}
					fallback={
						<li class="text-sm text-muted-foreground">
							関連付けられたメディアがありません。
						</li>
					}
				>
					{(item, index) => (
						<li>
							<Button
								aria-pressed={props.selected === item.id}
								variant={props.selected === item.id ? "secondary" : "ghost"}
								class="w-full justify-start gap-3"
								onClick={() => props.select(item.id)}
							>
								<span class="text-muted-foreground">{index() + 1}</span>
								<span
									class="min-w-0 flex-1 truncate text-left"
									title={item.name}
								>
									{item.name}
								</span>
								<span class="tabular-nums">
									{item.count.toLocaleString()} 件
								</span>
							</Button>
						</li>
					)}
				</For>
			</ol>
		</Card>
	);
}

export function StatisticsScreen(props: {
	selection: StatisticsSelection;
	change: (selection: StatisticsSelection) => void;
	load: (
		request: StatisticsRequest,
		signal: AbortSignal,
	) => Promise<LibraryStatistics>;
}) {
	const location = useLocation();
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const query = createQuery(() => {
		const input = { ...props.selection, timeZone };
		return {
			queryKey: ["media", "statistics", input],
			queryFn: ({ signal }) => props.load(input, signal),
		};
	});
	const recent = () => props.selection.period !== "all";
	const isFiltered = () =>
		Boolean(
			props.selection.bucket ||
			props.selection.ipId ||
			props.selection.characterId,
		);
	const setBucket = (bucket: string) =>
		props.change({
			period: props.selection.period,
			bucket: bucket === props.selection.bucket ? undefined : bucket,
		});
	const setIp = (ipId: string) =>
		props.change({
			period: props.selection.period,
			bucket: props.selection.bucket,
			ipId: ipId === props.selection.ipId ? undefined : ipId,
		});
	const setCharacter = (id: string) =>
		props.change({
			...props.selection,
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
				title="ライブラリ統計"
				description="登録日ごとの取り込み件数と、作品・キャラクター別のメディア件数を表示します。"
				actions={
					<fieldset class="flex gap-1" aria-label="集計期間">
						<Button
							variant={recent() ? "default" : "outline"}
							aria-pressed={recent()}
							onClick={() => props.change({ period: "recent" })}
						>
							直近30日
						</Button>
						<Button
							variant={recent() ? "outline" : "default"}
							aria-pressed={!recent()}
							onClick={() => props.change({ period: "all" })}
						>
							全期間
						</Button>
					</fieldset>
				}
			/>
			<div class="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3 scrollbar-stable sm:p-5">
				<Switch>
					<Match when={query.data}>
						{(data) => (
							<>
								<Show
									when={data().trend.some((item) => item.count > 0)}
									fallback={
										<EmptyState title="この期間の取り込みはありません" />
									}
								>
									<ImportTrend
										trend={data().trend}
										monthly={!recent()}
										selected={props.selection.bucket}
										select={setBucket}
									/>
								</Show>
								<Show when={isFiltered()}>
									<div
										class="flex flex-wrap items-center gap-2 text-sm"
										aria-live="polite"
									>
										<strong>絞り込み中</strong>
										<Show when={props.selection.bucket}>
											{(value) => (
												<span>{recent() ? value() : value().slice(0, 7)}</span>
											)}
										</Show>
										<Show when={props.selection.ipId}>
											<span>
												{data().ips.find((ip) => ip.id === props.selection.ipId)
													?.name ?? "選択したIP"}
											</span>
										</Show>
										<Show when={props.selection.characterId}>
											<span>
												{data().characters.find(
													(c) => c.id === props.selection.characterId,
												)?.name ?? "選択したキャラクター"}
											</span>
										</Show>
										<Button
											variant="outline"
											onClick={() =>
												props.change({ period: props.selection.period })
											}
										>
											絞り込みを解除
										</Button>
									</div>
								</Show>
								<div class="grid gap-4 lg:grid-cols-2">
									<Ranking
										title="IPランキング"
										items={data().ips}
										selected={props.selection.ipId}
										select={setIp}
									/>
									<Ranking
										title="キャラクターランキング"
										items={data().characters}
										selected={props.selection.characterId}
										select={setCharacter}
									/>
								</div>
								<Show when={isFiltered()}>
									<Card class="p-4">
										<h2 class="mb-2 font-semibold">該当するメディア</h2>
										<ul class="divide-y divide-border text-sm">
											<For
												each={data().media}
												fallback={<li>該当するメディアはありません。</li>}
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
													前へ
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
													次へ
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
						<ErrorState title="統計を取得できませんでした" onRetry={retry} />
					</Match>
					<Match when={query.isPending}>
						<output>統計を読み込み中…</output>
					</Match>
				</Switch>
			</div>
		</section>
	);
}
