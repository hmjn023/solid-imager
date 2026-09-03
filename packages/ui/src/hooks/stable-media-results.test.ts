import type {
	Media,
	MediaSearchResponse,
} from "@solid-imager/core/domain/media/schemas";
import type { InfiniteData } from "@tanstack/solid-query";
import { createStore } from "solid-js/store";
import { describe, expect, it } from "vitest";
import {
	type StableMediaResultsState,
	updateStableMediaResults,
} from "./stable-media-results";

const TEST_MEDIA: Media = {
	id: "11111111-1111-4111-8111-111111111111",
	mediaSourceId: "22222222-2222-4222-8222-222222222222",
	filePath: "/images/example.png",
	fileName: "example.png",
	mediaType: "image",
	width: 1024,
	height: 1024,
	fileSize: 1024,
	description: null,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	modifiedAt: new Date("2026-01-01T00:00:00.000Z"),
	indexedAt: new Date("2026-01-01T00:00:00.000Z"),
	status: "active",
};

function infiniteData(
	media: Media[],
): InfiniteData<MediaSearchResponse, number> {
	return {
		pages: [{ media, total: media.length }],
		pageParams: [0],
	};
}

describe("createStableMediaResults", () => {
	it("preserves existing media identity across refreshed query objects", () => {
		const [state, setState] = createStore<StableMediaResultsState>({
			items: [],
		});
		updateStableMediaResults(setState, infiniteData([TEST_MEDIA]));
		const original = state.items[0];

		updateStableMediaResults(
			setState,
			infiniteData([
				{ ...TEST_MEDIA, fileName: "updated.png" },
				{
					...TEST_MEDIA,
					id: "33333333-3333-4333-8333-333333333333",
					fileName: "new.png",
				},
			]),
		);

		expect(state.items[0]).toBe(original);
		expect(state.items[0].fileName).toBe("updated.png");
		expect(state.items).toHaveLength(2);
	});

	it("deduplicates media returned across pages", () => {
		const [state, setState] = createStore<StableMediaResultsState>({
			items: [],
		});
		const data: InfiniteData<MediaSearchResponse, number> = {
			pages: [
				{ media: [TEST_MEDIA], total: 1 },
				{ media: [{ ...TEST_MEDIA }], total: 1 },
			],
			pageParams: [0, 1],
		};
		updateStableMediaResults(setState, data);

		expect(state.items).toHaveLength(1);
	});
});
