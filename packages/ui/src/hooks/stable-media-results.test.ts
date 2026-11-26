import type { Media, MediaSearchResponse } from "@solid-imager/core/media";
import type { InfiniteData } from "@tanstack/solid-query";
import { createRoot, createSignal, flush } from "solid-js";
import { describe, expect, it, onTestFinished } from "vitest";
import { createStableMediaResults } from "./stable-media-results";

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
		const { results, setData } = createRoot((dispose) => {
			onTestFinished(dispose);
			const [data, setData] = createSignal(infiniteData([TEST_MEDIA]));
			return { results: createStableMediaResults(data), setData };
		});
		const original = results()[0];

		setData(
			infiniteData([
				{ ...TEST_MEDIA, fileName: "updated.png" },
				{
					...TEST_MEDIA,
					id: "33333333-3333-4333-8333-333333333333",
					fileName: "new.png",
				},
			]),
		);

		flush();
		expect(results()[0]).toBe(original);
		expect(results()[0].fileName).toBe("updated.png");
		expect(results()).toHaveLength(2);
	});

	it("deduplicates media returned across pages", () => {
		const data: InfiniteData<MediaSearchResponse, number> = {
			pages: [
				{ media: [TEST_MEDIA], total: 1 },
				{ media: [{ ...TEST_MEDIA }], total: 1 },
			],
			pageParams: [0, 1],
		};
		const results = createRoot((dispose) => {
			onTestFinished(dispose);
			return createStableMediaResults(() => data);
		});

		expect(results()).toHaveLength(1);
	});
});
