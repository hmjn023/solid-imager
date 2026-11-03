import type { MediaType } from "@solid-imager/core/domain/media/schemas";
import type { LibraryStatistics } from "@solid-imager/core/domain/media/statistics";
import { areaY, barY, defineChart, lineY } from "@tanstack/charts";
import { pie, polar, radialArc } from "@tanstack/charts/polar";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { Chart } from "@tanstack/charts/solid";
import { tooltip } from "@tanstack/charts/tooltip";
import { createMemo, For, Show } from "solid-js";
import { Button } from "../../button";
import { Card } from "../../card";

const primary = "hsl(var(--primary))";
const chartTheme = {
	foreground: "hsl(var(--foreground))",
	muted: "hsl(var(--muted-foreground))",
	grid: "hsl(var(--border))",
	background: "hsl(var(--card))",
};
const typeStyle = {
	image: { label: "画像", fill: primary, swatch: "bg-primary" },
	video: {
		label: "動画",
		fill: "hsl(var(--info-foreground))",
		swatch: "bg-info-foreground",
	},
	audio: {
		label: "音声",
		fill: "hsl(var(--warning-foreground))",
		swatch: "bg-warning-foreground",
	},
} satisfies Record<MediaType, { label: string; fill: string; swatch: string }>;
const mediaTypes: readonly MediaType[] = ["image", "video", "audio"];

function PanelTitle(props: { index: string; title: string }) {
	return (
		<div class="flex items-center gap-2.5">
			<span
				aria-hidden="true"
				class="font-mono text-xs tabular-nums text-muted-foreground"
			>
				{props.index}
			</span>
			<span aria-hidden="true" class="h-3 w-px bg-border" />
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
	const rows = createMemo(() => {
		let cumulative = 0;
		return props.trend.map((item) => {
			cumulative += item.count;
			return { ...item, cumulative };
		});
	});
	const total = () => rows().at(-1)?.cumulative ?? 0;
	const peak = createMemo(() =>
		rows().reduce<LibraryStatistics["trend"][number] | undefined>(
			(largest, item) =>
				!largest || item.count > largest.count ? item : largest,
			undefined,
		),
	);
	const label = (bucket: string) =>
		props.monthly ? bucket.slice(0, 7) : bucket;
	const chart = createMemo(() =>
		defineChart({
			marks: props.cumulative
				? [
						areaY(rows(), {
							id: "期間内累計",
							x: "bucket",
							y: "cumulative",
							y1: 0,
							fill: primary,
							fillOpacity: 0.1,
						}),
						lineY(rows(), {
							id: "累計",
							x: "bucket",
							y: "cumulative",
							stroke: primary,
							points: rows().length < 2,
						}),
					]
				: [
						barY(rows(), {
							id: "取り込み件数",
							x: "bucket",
							y: "count",
							maxThickness: 46,
							radius: [3, 3, 0, 0],
							fill: (item) =>
								props.selected && props.selected !== item.bucket
									? "hsl(var(--primary) / 0.35)"
									: primary,
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
				<PanelTitle index="01" title="取り込み推移" />
				<fieldset
					aria-label="推移の表示方法"
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
								{cumulative ? "累計" : "件数"}
							</Button>
						)}
					</For>
				</fieldset>
			</div>
			<div class="flex flex-wrap items-end justify-between gap-3">
				<div>
					<p class="text-xs text-muted-foreground">
						{props.monthly ? "月別" : "日別"} · 計
					</p>
					<p class="mt-1 flex items-baseline gap-1.5">
						<strong class="text-3xl font-semibold tracking-tight tabular-nums">
							{total().toLocaleString()}
						</strong>
						<span class="text-xs text-muted-foreground">件</span>
					</p>
				</div>
				<div class="border-l border-border pl-3 text-xs">
					<p class="text-muted-foreground">
						{props.monthly ? "取り込み最多月" : "取り込み最多日"}
					</p>
					<Show when={peak()}>
						{(item) => (
							<p class="mt-1 font-medium tabular-nums">
								{label(item().bucket)} · {item().count.toLocaleString()} 件
							</p>
						)}
					</Show>
				</div>
			</div>
			<Chart
				ariaLabel={
					props.cumulative ? "取り込みの期間内累計" : "メディアの取り込み件数"
				}
				definition={chart()}
				height={186}
				onSelect={(point) => {
					if (point) props.select(point.datum.bucket);
				}}
			/>
			<details class="mt-auto border-t border-border pt-3 text-xs">
				<summary class="w-fit cursor-pointer text-muted-foreground hover:text-foreground">
					件数を一覧で見る
				</summary>
				<ul class="mt-2 grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
					<For each={rows()}>
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
										{(props.cumulative
											? item.cumulative
											: item.count
										).toLocaleString()}{" "}
										件
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
			<PanelTitle index="02" title="メディアの内訳" />
			<p class="text-xs text-muted-foreground">
				{props.filtered ? "絞り込みに一致したメディア" : "集計期間内のメディア"}
				の構成比
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
						ariaLabel="画像・動画・音声の構成比"
						definition={chart()}
						height={144}
					/>
				</Show>
				<div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
					<span class="text-xs text-muted-foreground">合計</span>
					<strong class="text-2xl font-semibold tracking-tight tabular-nums">
						{total().toLocaleString()}
					</strong>
				</div>
			</div>
			<ul class="divide-y divide-border border-t border-border">
				<For each={counts()}>
					{(item) => (
						<li class="flex items-center gap-2 py-2 text-xs">
							<span
								aria-hidden="true"
								class={`size-2 shrink-0 rounded-sm ${item.swatch}`}
							/>
							<span class="flex-1 font-medium">{item.label}</span>
							<span class="tabular-nums">{item.count.toLocaleString()} 件</span>
							<span class="w-12 text-right tabular-nums text-muted-foreground">
								{total()
									? ((100 * item.count) / total()).toLocaleString("ja-JP", {
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
					title={isIp() ? "IPランキング" : "キャラクターランキング"}
				/>
				<span class="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
					上位10件
				</span>
			</div>
			<ol class="px-2 py-2 sm:px-3">
				<For
					each={props.items}
					fallback={
						<li class="p-3 text-sm text-muted-foreground">
							関連付けられたメディアがありません。
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
											{item.count.toLocaleString()} 件
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
											class={isIp() ? "fill-primary" : "fill-info-foreground"}
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
			<PanelTitle index="05" title="生成モデル別のお気に入り" />
			<p class="mt-2 text-xs text-muted-foreground">
				お気に入り件数の上位5モデル。棒の長さは、各モデルの登録件数に占めるお気に入りの割合です。
			</p>
			<ul class="mt-4 divide-y divide-border border-t border-border">
				<For
					each={props.models}
					fallback={
						<li class="py-3 text-sm text-muted-foreground">
							この範囲に生成モデル名が記録されたメディアはありません。
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
									{model.favorites.toLocaleString()} /{" "}
									{model.count.toLocaleString()} 件
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
											class="fill-primary"
										/>
									</svg>
									<strong class="w-14 text-right font-medium tabular-nums">
										{percent.toLocaleString("ja-JP", {
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
