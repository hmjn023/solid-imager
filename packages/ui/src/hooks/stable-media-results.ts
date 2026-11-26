import type { MediaSearchResponse } from "@solid-imager/core/media";
import type { InfiniteData } from "@tanstack/solid-query";
import { createProjection, type Accessor } from "solid-js";

/** Reactively exposes a deduplicated result list with stable item identities across query updates. */
export function createStableMediaResults(
	data: Accessor<InfiniteData<MediaSearchResponse> | undefined>,
): Accessor<MediaSearchResponse["media"]> {
	const items = createProjection<MediaSearchResponse["media"]>(
		() => {
			const seen = new Set<string>();
			return (data()?.pages ?? [])
				.flatMap((page) => page.media)
				.filter((media) => {
					if (seen.has(media.id)) return false;
					seen.add(media.id);
					return true;
				});
		},
		[],
		{ key: "id" },
	);
	return () => items;
}
