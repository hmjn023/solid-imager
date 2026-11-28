import { t } from "@solid-imager/i18n";
import type { MediaType } from "@solid-imager/core/media";
import type { LibraryStatistics } from "@solid-imager/core/statistics";
import {
	areaY,
	barY,
	defineChart,
	lineY,
	type ChartHostOptions,
	type ChartValue,
} from "@tanstack/charts";
import { createChartAdapter } from "@tanstack/charts/adapter";
import { pie, polar, radialArc } from "@tanstack/charts/polar";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import {
	createMemo,
	createRenderEffect,
	createUniqueId,
	onCleanup,
	onSettled,
	untrack,
} from "solid-js";

const chartPrimary = "hsl(var(--primary))";
const chartTheme = {
	foreground: "hsl(var(--foreground))",
	muted: "hsl(var(--muted-foreground))",
	grid: "hsl(var(--border))",
	background: "hsl(var(--card))",
};

function Chart<TDatum, TXValue extends ChartValue, TYValue extends ChartValue>(
	props: ChartHostOptions<TDatum, TXValue, TYValue> & { height: number },
) {
	const idPrefix = `ts-chart-${createUniqueId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
	const options = () => ({
		definition: props.definition,
		height: props.height,
		ariaLabel: props.ariaLabel,
		onSelect: props.onSelect,
		idPrefix,
	});
	const adapter = createChartAdapter(untrack(options));
	const initialSvg = adapter.prerender();
	let surface: HTMLDivElement | undefined;
	createRenderEffect(options, adapter.update);
	onSettled(() => {
		if (surface) adapter.mount(surface);
	});
	onCleanup(adapter.destroy);

	return (
		<div
			class="ts-chart-host"
			style={{
				position: "relative",
				width: "100%",
				height: `${props.height}px`,
			}}
		>
			<div
				ref={surface}
				class="ts-chart-surface"
				style={{ width: "100%", height: "100%" }}
				innerHTML={initialSvg}
			/>
		</div>
	);
}

export type TrendGraphProps = {
	trend: LibraryStatistics["trend"];
	monthly: boolean;
	cumulative: boolean;
	selected?: string;
	select: (bucket: string) => void;
};

export function TrendGraph(props: TrendGraphProps) {
	const chart = createMemo(() =>
		defineChart({
			marks: props.cumulative
				? [
						areaY(props.trend, {
							id: t("charts.libraryTotal"),
							x: "bucket",
							y: "cumulative",
							y1: 0,
							fill: chartPrimary,
							fillOpacity: 0.1,
						}),
						lineY(props.trend, {
							id: t("charts.cumulative"),
							x: "bucket",
							y: "cumulative",
							stroke: chartPrimary,
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
									? "color-mix(in srgb, hsl(var(--primary)) 30%, hsl(var(--card)))"
									: chartPrimary,
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
		<Chart
			ariaLabel={
				props.cumulative
					? t("charts.cumulativeMediaInLibrary")
					: t("charts.mediaImported")
			}
			definition={chart()}
			height={192}
			onSelect={(point) => {
				if (point) props.select(point.datum.bucket);
			}}
		/>
	);
}

export function CompositionGraph(props: {
	counts: { type: MediaType; count: number; label: string; fill: string }[];
}) {
	const chart = createMemo(() => {
		const nonzero = props.counts.filter((item) => item.count > 0);
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
		<Chart
			ariaLabel={t("charts.imageVideoAndAudioDistribution")}
			definition={chart()}
			height={144}
		/>
	);
}
