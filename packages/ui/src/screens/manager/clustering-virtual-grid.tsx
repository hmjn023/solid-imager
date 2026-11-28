/* oxlint-disable jsx-a11y/no-redundant-roles -- Explicit roles preserve list semantics with reset list styles and presentational virtual rows. */
import {
	createVirtualizer,
	defaultRangeExtractor,
} from "../../utils/virtualizer";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	type Accessor,
} from "solid-js";
import type { JSX } from "@solidjs/web";
import { getMediaGridColumnCount } from "../../skeleton";

/** Uses the Manager or dialog scroller; cards may have different measured heights. */
export function ClusteringVirtualGrid<T>(props: {
	scrollRoot: Accessor<HTMLElement | undefined>;
	items: T[];
	itemKey: (item: T) => string | number;
	label: string;
	layout: "groups" | "images" | "large-images";
	resetKey: string;
	total: number;
	canLoadMore: boolean;
	onLoadMore: () => void;
	children: (item: T, index: number) => JSX.Element;
}) {
	let root: HTMLUListElement | undefined;
	let metricsFrame: number | undefined;
	let measureFrame: number | undefined;
	const scroller = () => props.scrollRoot() ?? null;
	const [width, setWidth] = createSignal(0);
	const [margin, setMargin] = createSignal(0);
	const [focusedKey, setFocusedKey] = createSignal<string | number | null>(
		null,
	);
	const columns = createMemo(() =>
		props.layout === "groups"
			? Math.max(1, Math.min(3, Math.floor(width() / 320)))
			: props.layout === "large-images"
				? Math.max(2, Math.min(4, Math.floor(width() / 300)))
				: getMediaGridColumnCount(width()),
	);
	const rows = () => Math.ceil(props.items.length / columns());
	const focusedRow = () => {
		const key = focusedKey();
		const index =
			key === null
				? -1
				: props.items.findIndex((item) => props.itemKey(item) === key);
		return index < 0 ? -1 : Math.floor(index / columns());
	};
	const virtualizer = createVirtualizer<HTMLElement, HTMLLIElement>({
		get count() {
			return rows();
		},
		getScrollElement: scroller,
		get scrollMargin() {
			return margin();
		},
		get estimateSize() {
			const columnWidth = width() / columns();
			const estimate =
				props.layout === "groups"
					? columnWidth / 2 + 180
					: columnWidth * 0.75 + 130;
			return () => estimate;
		},
		get getItemKey() {
			const items = props.items;
			const columnsPerRow = columns();
			const keyOf = props.itemKey;
			return (index: number) => {
				const item = items[index * columnsPerRow];
				return item ? keyOf(item) : index;
			};
		},
		gap: 12,
		overscan: 2,
		useAnimationFrameWithResizeObserver: true,
		get rangeExtractor() {
			const focused = focusedRow();
			return (range: Parameters<typeof defaultRangeExtractor>[0]) => {
				const visible = defaultRangeExtractor(range);
				return focused >= 0 && !visible.includes(focused)
					? [...visible, focused].sort((a, b) => a - b)
					: visible;
			};
		},
	});
	const updateMetrics = () => {
		const owner = scroller();
		if (!root || !owner) return;
		const bounds = root.getBoundingClientRect();
		setWidth(bounds.width);
		setMargin(
			bounds.top -
				owner.getBoundingClientRect().top +
				owner.scrollTop -
				owner.clientTop,
		);
	};
	const scheduleMetrics = () => {
		if (metricsFrame !== undefined) return;
		metricsFrame = requestAnimationFrame(() => {
			metricsFrame = undefined;
			updateMetrics();
		});
	};
	const remeasure = () => {
		virtualizer.measure();
		if (measureFrame !== undefined) cancelAnimationFrame(measureFrame);
		const measureVisible = () => {
			// The virtualizer skips synchronous measurements during scrolling,
			// including the scroll notification used after resetting a list.
			if (virtualizer.isScrolling) {
				measureFrame = requestAnimationFrame(measureVisible);
				return;
			}
			measureFrame = undefined;
			// Clearing cached heights does not notify ResizeObserver when a row
			// keeps the same dimensions (for example two columns in both sizes).
			for (const row of Array.from(root?.children ?? [])) {
				if (row instanceof HTMLLIElement) virtualizer.measureElement(row);
			}
		};
		measureFrame = requestAnimationFrame(measureVisible);
	};
	createEffect(scroller, (owner) => {
		if (!owner || !root) return;
		updateMetrics();
		const observer = new ResizeObserver(scheduleMetrics);
		observer.observe(root);
		observer.observe(owner);
		if (root.parentElement) observer.observe(root.parentElement);
		owner.addEventListener("scroll", updateMetrics, { passive: true });
		return () => {
			if (metricsFrame !== undefined) cancelAnimationFrame(metricsFrame);
			if (measureFrame !== undefined) cancelAnimationFrame(measureFrame);
			observer.disconnect();
			owner.removeEventListener("scroll", updateMetrics);
		};
	});
	createEffect(
		() => props.resetKey,
		(_key, previous) => {
			if (previous === undefined) return;
			setFocusedKey(null);
			updateMetrics();
			const owner = scroller();
			if (owner) owner.scrollTop = Math.min(owner.scrollTop, margin());
			remeasure();
			owner?.dispatchEvent(new Event("scroll"));
		},
	);
	createEffect(
		() => [columns(), width(), props.layout],
		() => {
			remeasure();
			scroller()?.dispatchEvent(new Event("scroll"));
		},
	);
	createEffect(
		() => {
			const last = virtualizer.getVirtualItems().at(-1);
			return {
				canLoadMore: props.canLoadMore,
				lastIndex: last?.index,
				rowCount: rows(),
			};
		},
		({ canLoadMore, lastIndex, rowCount }) => {
			if (canLoadMore && lastIndex !== undefined && lastIndex >= rowCount - 3)
				props.onLoadMore();
		},
	);
	return (
		<ul
			aria-label={props.label}
			class="relative min-w-0 w-full h-(--clustering-grid-height)"
			data-clustering-grid={props.layout}
			data-loaded={props.items.length}
			ref={(element) => {
				root = element;
			}}
			role="list"
			style={{
				"--clustering-grid-height": `${virtualizer.getTotalSize()}px`,
				"--clustering-columns": `repeat(${columns()}, minmax(0, 1fr))`,
			}}
		>
			<For each={virtualizer.getVirtualItems()}>
				{(row) => (
					<li
						class="absolute top-0 left-0 w-full translate-y-(--clustering-row-offset)"
						data-index={row.index}
						ref={(element) => {
							// Solid runs refs before applying dynamic attributes.
							element.setAttribute("data-index", String(row.index));
							virtualizer.measureElement(element);
						}}
						role="presentation"
						style={{
							"--clustering-row-offset": `${row.start - margin()}px`,
						}}
					>
						<ul
							class="grid grid-cols-(--clustering-columns) gap-3"
							role="presentation"
						>
							<For
								each={props.items.slice(
									row.index * columns(),
									(row.index + 1) * columns(),
								)}
							>
								{(item, index) => (
									<li
										aria-posinset={row.index * columns() + index() + 1}
										aria-setsize={props.total}
										class="min-w-0"
										data-review-key={props.itemKey(item)}
										onFocusIn={() => setFocusedKey(props.itemKey(item))}
										onFocusOut={(event) => {
											if (
												!(event.relatedTarget instanceof Node) ||
												!root?.contains(event.relatedTarget)
											)
												setFocusedKey(null);
										}}
										role="listitem"
									>
										{props.children(item, row.index * columns() + index())}
									</li>
								)}
							</For>
						</ul>
					</li>
				)}
			</For>
		</ul>
	);
}
