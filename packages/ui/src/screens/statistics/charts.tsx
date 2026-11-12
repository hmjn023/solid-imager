import { getLocale, t } from "@solid-imager/i18n";
import type { MediaType } from "@solid-imager/core/media";
import type { LibraryStatistics } from "@solid-imager/core/statistics";
import { areaY, barY, defineChart, lineY } from "@tanstack/charts";
import { pie, polar, radialArc } from "@tanstack/charts/polar";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { Chart } from "@tanstack/charts/solid";
import { tooltip } from "@tanstack/charts/tooltip";
import { createMemo, For, Show } from "solid-js";
import { Button } from "../../button";
import { Card } from "../../card";

const chartBlue = "var(--chart-blue)";
const chartTheme = {
	foreground: "hsl(var(--foreground))",
	muted: "hsl(var(--muted-foreground))",
	grid: "hsl(var(--border))",
	background: "hsl(var(--card))",
};
const typeStyle = {
	image: { label: t("charts.images"), fill: "var(--chart-amber)" },
	video: { label: t("labels.media.video"), fill: chartBlue },
	audio: { label: t("labels.media.audio"), fill: "var(--chart-violet)" },
} satisfies Record<MediaType, { label: string; fill: string }>;
const mediaTypes: readonly MediaType[] = ["image", "video", "audio"];

function PanelTitle(props: { index: string; title: string; accent: string }) {
	return (
		<div class="flex items-center gap-2.5">
			<span
				aria-hidden="true"
				class="font-mono text-xs tabular-nums text-muted-foreground"
			>
				{props.index}
			</span>
			<span
				aria-hidden="true"
				class={`h-3.5 w-1 rounded-full ${props.accent}`}
			/>
			<h2 class="text-base font-semibold tracking-tight">{props.title}</h2>
		</div>
	);
}

export function ImportTrend(props: {
	trend: LibraryStatistics["trend"];
	monthly: boolean;
	cumulative: boolean;
	onCumulative: (enabled: boolean) => void;
	selected?: string;
	select: (bucket: string) => void;
}) {
	const total = createMemo(() =>
		props.cumulative
			? (props.trend.at(-1)?.cumulative ?? 0)
			: props.trend.reduce((sum, item) => sum + item.count, 0),
	);
	const peak = createMemo(() =>
		props.trend.reduce<LibraryStatistics["trend"][number] | undefined>(
			(largest, item) => (item.count > (largest?.count ?? 0) ? item : largest),
			undefined,
		),
	);
	const label = (bucket: string) =>
		props.monthly ? bucket.slice(0, 7) : bucket;
	const chart = createMemo(() =>
		defineChart({
			marks: props.cumulative
				? [
						areaY(props.trend, {
							id: t("charts.libraryTotal"),
							x: "bucket",
							y: "cumulative",
							y1: 0,
							fill: chartBlue,
							fillOpacity: 0.1,
						}),
						lineY(props.trend, {
							id: t("charts.cumulative"),
							x: "bucket",
							y: "cumulative",
							stroke: chartBlue,
							points: props.trend.length < 2,
						}),
					]
				: [
						barY(props.trend, {
							id: t("charts.imports"),
							x: "bucket",
							y: "count",
							maxThickness: 46,
							radius: [3, 3, 0, 0],
							fill: (item) =>
								props.selected && props.selected !== item.bucket
									? "color-mix(in srgb, var(--chart-blue) 77%, transparent)"
									: chartBlue,
						}),
					],
			scales: {
				x: {
					scale: () => scaleBand<string>().padding(0.22),
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
							count: 4,
							format: (n) => (Number.isInteger(n) ? n.toLocaleString() : ""),
						},
					},
				},
			},
			theme: chartTheme,
			tooltip,
		}),
	);
	return (
		<Card class="flex min-w-0 flex-col gap-4 p-4 shadow-none sm:p-5">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<PanelTitle
					index="01"
					title={t("charts.importTrends")}
					accent="bg-chart-blue"
				/>
				<fieldset
					aria-label={t("charts.trendDisplay")}
					class="flex rounded-md bg-muted p-1"
				>
					<For each={[false, true]}>
						{(cumulative) => (
							<Button
								variant={props.cumulative === cumulative ? "outline" : "ghost"}
								aria-pressed={props.cumulative === cumulative}
								class="h-10 px-3 text-xs sm:h-8"
								classList={{ "bg-card": props.cumulative === cumulative }}
								onClick={() => props.onCumulative(cumulative)}
							>
								{cumulative ? t("charts.cumulative") : t("charts.count")}
							</Button>
						)}
					</For>
				</fieldset>
			</div>
			<div class="flex flex-wrap items-end justify-between gap-3">
				<div>
					<p class="text-xs text-muted-foreground">
						{props.monthly ? t("charts.monthly") : t("charts.daily")} ·{" "}
						{props.cumulative
							? t("charts.libraryTotal")
							: t("charts.periodTotal")}
					</p>
					<p class="mt-1 flex items-baseline gap-1.5">
						<strong class="text-3xl font-semibold tracking-tight tabular-nums">
							{total().toLocaleString()}
						</strong>
						<span class="text-xs text-muted-foreground">
							{t("charts.items")}
						</span>
					</p>
				</div>
				<div class="border-l border-border pl-3 text-xs">
					<p class="text-muted-foreground">
						{props.monthly ? t("charts.busiestMonth") : t("charts.busiestDay")}
					</p>
					<Show when={peak()} fallback={<span>{t("charts.noImports")}</span>}>
						{(item) => (
							<p class="mt-1 font-medium tabular-nums">
								{t("charts.valueValueItems", {
									value0: String(label(item().bucket)),
									value1: String(item().count.toLocaleString()),
								})}
							</p>
						)}
					</Show>
				</div>
			</div>
			<Chart
				ariaLabel={
					props.cumulative
						? t("charts.cumulativeMediaInLibrary")
						: t("charts.mediaImported")
				}
				definition={chart()}
				height={186}
				onSelect={(point) => {
					if (point) props.select(point.datum.bucket);
				}}
			/>
			<details class="mt-auto border-t border-border pt-3 text-xs">
				<summary class="w-fit cursor-pointer text-muted-foreground hover:text-foreground">
					{t("charts.viewCountsAsAList")}
				</summary>
				<p class="mt-2 text-muted-foreground">
					{t("charts.countsMediaCurrentlyInTheLibraryByDatabaseRegistration")}
				</p>
				<ul class="mt-2 grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
					<For each={props.trend}>
						{(item) => (
							<li>
								<Button
									class="w-full justify-between gap-1 px-2 text-xs tabular-nums"
									variant={
										props.selected === item.bucket ? "secondary" : "ghost"
									}
									aria-pressed={props.selected === item.bucket}
									onClick={() => props.select(item.bucket)}
								>
									{label(item.bucket)}{" "}
									<span>
										{t("charts.valueValueItems2", {
											value0: String(
												(props.cumulative
													? item.cumulative
													: item.count
												).toLocaleString(),
											),
										})}
									</span>
								</Button>
							</li>
						)}
					</For>
				</ul>
			</details>
		</Card>
	);
}

export function MediaComposition(props: {
	items: LibraryStatistics["mediaTypes"];
	filtered: boolean;
}) {
	const counts = createMemo(() =>
		mediaTypes.map((type) => ({
			type,
			...typeStyle[type],
			count: props.items.find((item) => item.type === type)?.count ?? 0,
		})),
	);
	const total = () => counts().reduce((sum, item) => sum + item.count, 0);
	const chart = createMemo(() => {
		const nonzero = counts().filter((item) => item.count > 0);
		const slices = pie(nonzero, {
			value: "count",
			gapAngle: nonzero.length > 1 ? 0.035 : 0,
		});
		return defineChart({
			margin: 2,
			marks: [
				polar({
					scales: { angle: null, radius: null },
					marks: [
						radialArc(slices, {
							key: "type",
							z: "label",
							innerRadius: ({ radius }) => radius * 0.75,
							fill: (slice) => slice.fill,
							cornerRadius: 2,
						}),
					],
				}),
			],
			scales: { x: null, y: null },
			theme: chartTheme,
		});
	});
	return (
		<Card class="flex min-w-0 flex-col gap-3 p-4 shadow-none sm:p-5">
			<PanelTitle
				index="02"
				title={t("charts.mediaBreakdown")}
				accent="bg-chart-amber"
			/>
			<p class="text-xs text-muted-foreground">
				{t("charts.valueDistribution", {
					value0: String(
						props.filtered
							? t("charts.mediaMatchingTheFilter")
							: t("charts.mediaInTheReportingPeriod"),
					),
				})}
			</p>
			<div class="relative mx-auto my-auto w-full max-w-48">
				<Show
					when={total()}
					fallback={
						<div
							aria-hidden="true"
							class="mx-auto h-36 w-36 rounded-full border-12 border-muted"
						/>
					}
				>
					<Chart
						ariaLabel={t("charts.imageVideoAndAudioDistribution")}
						definition={chart()}
						height={144}
					/>
				</Show>
				<div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
					<span class="text-xs text-muted-foreground">{t("charts.total")}</span>
					<strong class="text-2xl font-semibold tracking-tight tabular-nums">
						{total().toLocaleString()}
					</strong>
				</div>
			</div>
			<ul class="divide-y divide-border border-t border-border">
				<For each={counts()}>
					{(item) => (
						<li class="flex items-center gap-2 py-2 text-xs">
							<svg aria-hidden="true" class="size-2 shrink-0" viewBox="0 0 8 8">
								<rect width="8" height="8" rx="2" fill={item.fill} />
							</svg>
							<span class="flex-1 font-medium">{item.label}</span>
							<span class="tabular-nums">
								{t("charts.valueItems", {
									value0: String(item.count.toLocaleString()),
								})}
							</span>
							<span class="w-12 text-right tabular-nums text-muted-foreground">
								{total()
									? ((100 * item.count) / total()).toLocaleString(getLocale(), {
											maximumFractionDigits: 1,
										})
									: "0"}
								%
							</span>
						</li>
					)}
				</For>
			</ul>
		</Card>
	);
}

export function Ranking(props: {
	kind: "ip" | "character";
	periodLabel: string;
	items: LibraryStatistics["ips"];
	selected?: string;
	select: (id: string) => void;
}) {
	const isIp = () => props.kind === "ip";
	return (
		<Card class="min-w-0 overflow-hidden shadow-none">
			<div class="flex items-center justify-between gap-2 border-b border-border px-4 py-4 sm:px-5">
				<PanelTitle
					index={isIp() ? "03" : "04"}
					accent={isIp() ? "bg-chart-violet" : "bg-chart-coral"}
					title={
						isIp() ? t("charts.iPRankings") : t("charts.characterRankings")
					}
				/>
				<span class="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
					{t("charts.top10")}
				</span>
			</div>
			<p class="px-4 pt-2 text-xs text-muted-foreground sm:px-5">
				{t("charts.countsDirectAssociationsForMediaRegisteredInValue", {
					value0: String(props.periodLabel),
				})}
			</p>
			<ol class="px-2 py-2 sm:px-3">
				<For
					each={props.items}
					fallback={
						<li class="p-3 text-sm text-muted-foreground">
							{t("charts.noAssociatedMedia")}
						</li>
					}
				>
					{(item, index) => (
						<li>
							<Button
								aria-pressed={props.selected === item.id}
								variant={props.selected === item.id ? "secondary" : "ghost"}
								class="h-auto min-h-11 w-full items-start gap-3 px-2 py-2 text-left [&_svg]:h-1.5 [&_svg]:w-full"
								onClick={() => props.select(item.id)}
							>
								<span
									class={`pt-0.5 font-mono text-xs tabular-nums ${index() === 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}
								>
									{String(index() + 1).padStart(2, "0")}
								</span>
								<span class="flex min-w-0 flex-1 flex-col gap-1.5">
									<span class="flex items-baseline gap-2">
										<span class="min-w-0 flex-1 truncate" title={item.name}>
											{item.name}
										</span>
										<span class="shrink-0 text-xs tabular-nums">
											{t("charts.valueItems", {
												value0: String(item.count.toLocaleString()),
											})}
										</span>
									</span>
									<svg
										aria-hidden="true"
										height="5"
										width="100%"
										class="overflow-hidden rounded-sm bg-muted"
									>
										<rect
											width={`${(100 * item.count) / props.items[0].count}%`}
											height="5"
											rx="2"
											class={isIp() ? "fill-chart-violet" : "fill-chart-coral"}
										/>
									</svg>
								</span>
							</Button>
						</li>
					)}
				</For>
			</ol>
		</Card>
	);
}

/** Bar length encodes the share, while the label preserves its sample size. */
export function ModelFavorites(props: { models: LibraryStatistics["models"] }) {
	return (
		<Card class="min-w-0 p-4 shadow-none sm:p-5">
			<PanelTitle
				index="05"
				title={t("charts.favoritesByGenerationModel")}
				accent="bg-chart-rose"
			/>
			<p class="mt-2 text-xs text-muted-foreground">
				{t("charts.top5ModelsByFavoritesEachBarShowsThe")}
			</p>
			<ul class="mt-4 divide-y divide-border border-t border-border">
				<For
					each={props.models}
					fallback={
						<li class="py-3 text-sm text-muted-foreground">
							{t("charts.noMediaWithARecordedGenerationModelInThis")}
						</li>
					}
				>
					{(model) => {
						const percent = (100 * model.favorites) / model.count;
						return (
							<li class="grid grid-cols-2 items-center gap-x-4 gap-y-2 py-3 text-sm @2xl:grid-cols-3">
								<span class="truncate font-medium" title={model.name}>
									{model.name}
								</span>
								<span class="text-right text-xs tabular-nums text-muted-foreground @2xl:order-last">
									{t("charts.valueValueValueItems", {
										value0: String(model.favorites.toLocaleString()),
										value2: String(model.count.toLocaleString()),
									})}
								</span>
								<span class="col-span-2 flex items-center gap-3 @2xl:col-span-1">
									<svg
										aria-hidden="true"
										class="h-2 min-w-0 flex-1 rounded-sm bg-muted"
									>
										<rect
											width={`${percent}%`}
											height="100%"
											rx="2"
											class="fill-chart-rose"
										/>
									</svg>
									<strong class="w-14 text-right font-medium tabular-nums">
										{percent.toLocaleString(getLocale(), {
											maximumFractionDigits: 1,
										})}
										%
									</strong>
								</span>
							</li>
						);
					}}
				</For>
			</ul>
		</Card>
	);
}
