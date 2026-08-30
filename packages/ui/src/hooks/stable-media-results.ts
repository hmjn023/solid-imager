import type { MediaSearchResponse } from "@solid-imager/core/domain/media/schemas";
import type { InfiniteData } from "@tanstack/solid-query";
import type { Accessor } from "solid-js";
import { createComputed } from "solid-js";
import { createStore, produce, type SetStoreFunction } from "solid-js/store";

export type StableMediaResultsState = {
	items: MediaSearchResponse["media"];
};

export function updateStableMediaResults(
	setState: SetStoreFunction<StableMediaResultsState>,
	data: InfiniteData<MediaSearchResponse> | undefined,
): void {
	if (!data) {
		setState("items", []);
		return;
	}

	const seen = new Set<string>();
	const items = data.pages
		.flatMap((page) => page.media)
		.filter((media) => {
			if (seen.has(media.id)) {
				return false;
			}
			seen.add(media.id);
			return true;
		});
	setState(
		"items",
		produce((currentItems) => {
			const currentById = new Map(
				currentItems.map((media) => [media.id, media]),
			);
			const stableItems = items.map((media) => {
				const current = currentById.get(media.id);
				if (!current) {
					return media;
				}
				Object.assign(current, media);
				return current;
			});
			currentItems.splice(0, currentItems.length, ...stableItems);
		}),
	);
}

export function createStableMediaResults(
	data: Accessor<InfiniteData<MediaSearchResponse> | undefined>,
): Accessor<MediaSearchResponse["media"]> {
	const [state, setState] = createStore<StableMediaResultsState>({ items: [] });

	createComputed(() => {
		updateStableMediaResults(setState, data());
	});

	return () => state.items;
}
