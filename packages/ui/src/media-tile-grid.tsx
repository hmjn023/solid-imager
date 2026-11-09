import type { Accessor, JSX } from "solid-js";
import { For } from "solid-js";
import type { MediaGridImageLoadPolicy } from "./media-grid-item";
import { getMediaGridColumnCount, mediaGridClassName } from "./skeleton";
import {
	getCollectionNavigationIndex,
	isCollectionNavigationKey,
} from "./workspace/collection-navigation";

export const HIGH_PRIORITY_THUMBNAILS = 2;

type MediaTileGridProps<T> = {
	items: readonly T[];
	eagerCount?: number;
	onNavigate?: (item: T) => void;
	children: (
		item: T,
		imageLoadPolicy: MediaGridImageLoadPolicy | undefined,
		index: Accessor<number>,
	) => JSX.Element;
};

/** The responsive, nonvirtual grid used for a collection or one page of results. */
export function MediaTileGrid<T>(props: MediaTileGridProps<T>) {
	const navigate: JSX.EventHandler<HTMLElement, KeyboardEvent> = (event) => {
		if (
			event.defaultPrevented ||
			event.isComposing ||
			event.altKey ||
			event.ctrlKey ||
			event.metaKey ||
			!isCollectionNavigationKey(event.key)
		)
			return;
		if (
			!(event.target instanceof HTMLElement) ||
			!event.target.matches("[data-media-id]")
		)
			return;
		const grid = event.currentTarget;
		const tiles = Array.from(
			grid.querySelectorAll<HTMLElement>("[data-media-id]"),
		);
		const currentIndex = tiles.indexOf(event.target);
		if (currentIndex < 0) return;
		const scrollElement = grid.closest<HTMLElement>("[data-media-scroll]");
		const height = scrollElement?.clientHeight ?? window.innerHeight;
		const rowHeight =
			event.target.offsetHeight +
			Number.parseFloat(getComputedStyle(grid).rowGap);
		const next = getCollectionNavigationIndex({
			columnCount: getMediaGridColumnCount(grid.clientWidth),
			currentIndex,
			itemCount: tiles.length,
			key: event.key,
			pageRowCount: rowHeight > 0 ? Math.floor(height / rowHeight) : 1,
		});
		if (next === null) return;
		event.preventDefault();
		props.onNavigate?.(props.items[next]);
		tiles[next]?.focus();
	};

	return (
		// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Delegated navigation for the focused tile links/buttons.
		<section
			aria-label="メディアグリッド"
			class={mediaGridClassName}
			data-media-grid
			onKeyDown={navigate}
		>
			<For each={props.items}>
				{(item, index) =>
					props.children(
						item,
						props.eagerCount === undefined
							? undefined
							: {
									enabled: true,
									get fetchpriority() {
										return index() < HIGH_PRIORITY_THUMBNAILS
											? "high"
											: undefined;
									},
									get loading() {
										return index() < (props.eagerCount ?? 0) ? "eager" : "lazy";
									},
								},
						index,
					)
				}
			</For>
		</section>
	);
}
