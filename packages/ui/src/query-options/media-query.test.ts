import type { AppContractClient } from "@solid-imager/core/contract";
import { QueryClient } from "@tanstack/solid-query";
import type { RelatedMediaResponse } from "@solid-imager/core/media";
import { describe, expect, it, vi } from "vitest";
import { createAppQueryOptions } from "./app";
import { relatedMediaQueryKeys } from "./media-query";

describe("related media queries", () => {
	it("caches each seed separately and forwards it with the abort signal", async () => {
		const client = new QueryClient();
		const response: RelatedMediaResponse = {
			items: [],
			recommendations: [],
			similarityStatus: "not_indexed",
		};
		const fetch = vi.fn().mockResolvedValue(response);
		const { relatedMediaQueryOptions } = createAppQueryOptions({
			media: { getRelated: fetch },
		} as unknown as AppContractClient);
		const first = relatedMediaQueryOptions("source", "media", "first");
		const second = relatedMediaQueryOptions("source", "media", "second");
		await client.query(first);
		await client.query(second);
		await client.query(first);
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(fetch).toHaveBeenNthCalledWith(
			1,
			{ sourceId: "source", mediaId: "media", limit: 48, seed: "first" },
			{ signal: expect.any(AbortSignal) },
		);
		expect(fetch).toHaveBeenNthCalledWith(
			2,
			{ sourceId: "source", mediaId: "media", limit: 48, seed: "second" },
			{ signal: expect.any(AbortSignal) },
		);
		expect(
			client
				.getQueryCache()
				.findAll({ queryKey: relatedMediaQueryKeys.detail("source", "media") }),
		).toHaveLength(2);
		client.clear();
	});
});
