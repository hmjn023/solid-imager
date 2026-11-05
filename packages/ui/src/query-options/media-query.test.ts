import { QueryClient } from "@tanstack/solid-query";
import type { RelatedMediaResponse } from "@solid-imager/core/media";
import { describe, expect, it, vi } from "vitest";
import {
	buildRelatedMediaQueryOptions,
	relatedMediaQueryKeys,
} from "./media-query";

describe("related media queries", () => {
	it("caches each seed separately and forwards it with the abort signal", async () => {
		const client = new QueryClient();
		const response: RelatedMediaResponse = {
			items: [],
			recommendations: [],
			similarityStatus: "not_indexed",
		};
		const fetch = vi.fn().mockResolvedValue(response);
		const first = buildRelatedMediaQueryOptions(
			"source",
			"media",
			12,
			"first",
			fetch,
		);
		const second = buildRelatedMediaQueryOptions(
			"source",
			"media",
			12,
			"second",
			fetch,
		);
		await client.query(first);
		await client.query(second);
		await client.query(first);
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(fetch).toHaveBeenNthCalledWith(
			1,
			"source",
			"media",
			12,
			"first",
			expect.any(AbortSignal),
		);
		expect(fetch).toHaveBeenNthCalledWith(
			2,
			"source",
			"media",
			12,
			"second",
			expect.any(AbortSignal),
		);
		expect(
			client
				.getQueryCache()
				.findAll({ queryKey: relatedMediaQueryKeys.detail("source", "media") }),
		).toHaveLength(2);
		client.clear();
	});
});
