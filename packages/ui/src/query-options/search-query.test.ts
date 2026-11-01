import type {
	Media,
	MediaSearchRequest,
	MediaSearchResponse,
} from "@solid-imager/core/domain/media/schemas";
import { QueryClient } from "@tanstack/solid-query";
import { describe, expect, it, vi } from "vitest";
import {
	buildSearchResultsQueryOptions,
	buildSourceMediaResultsQueryOptions,
	isSourceMediaResultsQueryKey,
	MEDIA_RESULTS_STALE_TIME_MS,
	removeMediaFromInfiniteQueryData,
	searchQueryKeys,
	sourceMediaQueryKeys,
} from "./search-query";

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

const EMPTY_RESPONSE: MediaSearchResponse = { media: [], total: 0 };

const TEST_CONDITION = {
	type: "group",
	operator: "and",
	children: [
		{
			type: "criterion",
			target: "fileName",
			operator: "contains",
			value: "sample",
		},
	],
} satisfies MediaSearchRequest["condition"];

describe("query key factories", () => {
	it("keeps search invalidation as a prefix of result keys", () => {
		const key = searchQueryKeys.results({
			mode: "simple",
			sourceId: "source",
			conditionKey: "{}",
			sort: "date",
			order: "desc",
			limit: 100,
			similarityAnchorMediaId: null,
			similarityTopK: 50,
		});
		expect(key.slice(0, 1)).toEqual(searchQueryKeys.all());
	});

	it("keeps source invalidation as a prefix of source result keys", () => {
		const key = sourceMediaQueryKeys.results({
			sourceId: "source",
			conditionKey: "{}",
			sort: "date",
			order: "desc",
			limit: 200,
		});
		expect(key.slice(0, 2)).toEqual(sourceMediaQueryKeys.forSource("source"));
	});

	it("matches only source media result keys for local cache updates", () => {
		const resultKey = sourceMediaQueryKeys.results({
			sourceId: "source",
			conditionKey: "null",
			sort: undefined,
			order: "desc",
			limit: 200,
		});

		expect(isSourceMediaResultsQueryKey(resultKey, "source")).toBe(true);
		expect(
			isSourceMediaResultsQueryKey(["media", "source", "media-id"], "source"),
		).toBe(false);
	});
});

describe("removeMediaFromInfiniteQueryData", () => {
	it("removes a known deleted media item without touching other cached entries", () => {
		const otherMedia: Media = {
			...TEST_MEDIA,
			id: "33333333-3333-4333-8333-333333333333",
			fileName: "other.png",
		};
		const data = {
			pages: [{ media: [TEST_MEDIA, otherMedia], total: 2 }],
			pageParams: [0],
		};

		expect(removeMediaFromInfiniteQueryData(data, TEST_MEDIA.id)).toEqual({
			pages: [{ media: [otherMedia], total: 1 }],
			pageParams: [0],
		});
	});

	it("preserves the cached object when the deleted media is not loaded", () => {
		const data = {
			pages: [{ media: [TEST_MEDIA], total: 1 }],
			pageParams: [0],
		};

		expect(
			removeMediaFromInfiniteQueryData(
				data,
				"33333333-3333-4333-8333-333333333333",
			),
		).toBe(data);
	});
});

describe("buildSearchResultsQueryOptions", () => {
	it("keys semantic queries separately and sends text, source and pagination without filename filters", async () => {
		const searchSemantic = vi.fn(async () => ({
			media: [TEST_MEDIA],
			total: 2,
		}));
		const searchMedia = vi.fn();
		const input = {
			mode: "simple" as const,
			sourceId: "source",
			condition: TEST_CONDITION,
			conditionKey: "condition",
			sort: "date" as const,
			order: "desc" as const,
			limit: 20,
			similarityAnchorMediaId: null,
			similarityTopK: 50,
			similarityModel: "embeddinggemma2" as const,
			semanticQuery: "夕焼けの海",
			searchSemantic,
			searchMedia,
			searchSimilar: undefined,
		};
		const options = buildSearchResultsQueryOptions(input);
		const other = buildSearchResultsQueryOptions({
			...input,
			semanticQuery: "雪景色",
		});
		expect(options.queryKey).not.toEqual(other.queryKey);
		expect(options.placeholderData).toBeUndefined();
		if (typeof options.queryFn !== "function")
			throw new Error("queryFn missing");
		const signal = new AbortController().signal;
		await options.queryFn({
			client: new QueryClient(),
			queryKey: options.queryKey,
			signal,
			meta: undefined,
			pageParam: 20,
		} as any);
		expect(searchSemantic).toHaveBeenCalledWith(
			{
				text: "夕焼けの海",
				mediaSourceId: "source",
				limit: 20,
				offset: 20,
				topK: 50,
			},
			signal,
		);
		expect(searchMedia).not.toHaveBeenCalled();
		expect(
			options.getNextPageParam?.({ media: [], total: 2 }, [], 0, []),
		).toBeUndefined();
	});
	it("builds a stable key and forwards paged search input", async () => {
		const searchMedia = vi.fn(
			async (): Promise<MediaSearchResponse> => EMPTY_RESPONSE,
		);
		const searchSimilar = vi.fn(
			async (): Promise<MediaSearchResponse> => EMPTY_RESPONSE,
		);
		const options = buildSearchResultsQueryOptions({
			mode: "pro",
			sourceId: "source-1",
			condition: TEST_CONDITION,
			conditionKey: '{"type":"group"}',
			sort: "rating",
			order: "asc",
			limit: 40,
			similarityAnchorMediaId: null,
			similarityTopK: 25,
			searchMedia,
			searchSimilar,
			enabled: false,
			gcTime: 12_345,
		});

		expect(options.queryKey).toEqual([
			"searchResults",
			{
				mode: "pro",
				sourceId: "source-1",
				conditionKey: '{"type":"group"}',
				sort: "rating",
				order: "asc",
				limit: 40,
				similarityAnchorMediaId: null,
				similarityTopK: 25,
			},
		]);
		expect(options.initialPageParam).toBe(0);
		expect(options.enabled).toBe(false);
		expect(options.gcTime).toBe(12_345);
		expect(options.staleTime).toBe(MEDIA_RESULTS_STALE_TIME_MS);

		const queryFn = options.queryFn;
		if (typeof queryFn !== "function") {
			throw new Error("queryFn must be a function");
		}
		const signal = new AbortController().signal;
		// The query function only reads pageParam and signal; direction is deprecated.
		await queryFn({
			client: new QueryClient(),
			queryKey: options.queryKey,
			signal,
			meta: undefined,
			pageParam: 80,
		} as unknown as Parameters<typeof queryFn>[0]);

		expect(searchMedia).toHaveBeenCalledOnce();
		expect(searchMedia).toHaveBeenCalledWith(
			"source-1",
			{
				condition: TEST_CONDITION,
				sort: "rating",
				order: "asc",
				limit: 40,
				offset: 80,
			},
			signal,
		);
		expect(searchSimilar).not.toHaveBeenCalled();
	});

	it("uses loaded media count as the next offset", () => {
		const options = buildSearchResultsQueryOptions({
			mode: "simple",
			sourceId: undefined,
			condition: undefined,
			conditionKey: "null",
			sort: "date",
			order: "desc",
			limit: 1,
			similarityAnchorMediaId: null,
			similarityTopK: 50,
			searchMedia: async () => EMPTY_RESPONSE,
			searchSimilar: undefined,
		});
		const getNextPageParam = options.getNextPageParam;
		if (!getNextPageParam) {
			throw new Error("getNextPageParam must be defined");
		}
		const firstPage = { media: [TEST_MEDIA], total: 3 };
		const secondPage = { media: [TEST_MEDIA], total: 3 };

		expect(
			getNextPageParam(secondPage, [firstPage, secondPage], 1, [0, 1]),
		).toBe(2);
		expect(
			getNextPageParam(
				{ ...secondPage, total: 2 },
				[firstPage, { ...secondPage, total: 2 }],
				1,
				[0, 1],
			),
		).toBeUndefined();
	});

	it("forwards similarity ordering and paginates", async () => {
		const response = { media: [TEST_MEDIA], total: 10 };
		const searchMedia = vi.fn(
			async (): Promise<MediaSearchResponse> => EMPTY_RESPONSE,
		);
		const searchSimilar = vi.fn(
			async (): Promise<MediaSearchResponse> => response,
		);
		const options = buildSearchResultsQueryOptions({
			mode: "simple",
			sourceId: "source-2",
			condition: TEST_CONDITION,
			conditionKey: "vector-condition",
			sort: "name",
			order: "desc",
			limit: 100,
			similarityAnchorMediaId: "anchor-media",
			similarityTopK: 10,
			searchMedia,
			searchSimilar,
		});
		const queryFn = options.queryFn;
		if (typeof queryFn !== "function") {
			throw new Error("queryFn must be a function");
		}
		const signal = new AbortController().signal;

		await expect(
			queryFn({
				client: new QueryClient(),
				queryKey: options.queryKey,
				signal,
				meta: undefined,
				pageParam: 200,
			} as unknown as Parameters<typeof queryFn>[0]),
		).resolves.toEqual(response);
		expect(searchSimilar).toHaveBeenCalledWith(
			{
				anchorMediaId: "anchor-media",
				mediaSourceId: "source-2",
				topK: 10,
				limit: 100,
				offset: 200,
			},
			signal,
		);
		expect(searchMedia).not.toHaveBeenCalled();

		const getNextPageParam = options.getNextPageParam;
		if (!getNextPageParam) {
			throw new Error("getNextPageParam must be defined");
		}
		expect(getNextPageParam(response, [response], 0, [0])).toBe(1);
		expect(options.placeholderData).toBeUndefined();
	});

	it("returns an empty result when the similarity client is unavailable", async () => {
		const searchMedia = vi.fn(
			async (): Promise<MediaSearchResponse> => EMPTY_RESPONSE,
		);
		const options = buildSearchResultsQueryOptions({
			mode: "simple",
			sourceId: undefined,
			condition: undefined,
			conditionKey: "null",
			sort: undefined,
			order: "desc",
			limit: 100,
			similarityAnchorMediaId: "anchor-media",
			similarityTopK: 50,
			searchMedia,
			searchSimilar: undefined,
			enabled: false,
		});
		const queryFn = options.queryFn;
		if (typeof queryFn !== "function") {
			throw new Error("queryFn must be a function");
		}

		await expect(
			queryFn({
				client: new QueryClient(),
				queryKey: options.queryKey,
				signal: new AbortController().signal,
				meta: undefined,
				pageParam: 0,
			} as unknown as Parameters<typeof queryFn>[0]),
		).resolves.toEqual(EMPTY_RESPONSE);
		expect(options.enabled).toBe(false);
		expect(searchMedia).not.toHaveBeenCalled();
	});
});

describe("buildSourceMediaResultsQueryOptions", () => {
	it("searches natural language within the current source", async () => {
		const searchMedia = vi.fn(
			async (): Promise<MediaSearchResponse> => EMPTY_RESPONSE,
		);
		const searchSemantic = vi.fn(
			async (): Promise<MediaSearchResponse> => EMPTY_RESPONSE,
		);
		const options = buildSourceMediaResultsQueryOptions({
			sourceId: "source-3",
			condition: TEST_CONDITION,
			conditionKey: "test",
			sort: "size",
			order: "desc",
			limit: 200,
			semanticQuery: "  猫  ",
			similarityTopK: 50,
			searchMedia,
			searchSemantic,
		});
		const queryFn = options.queryFn;
		if (typeof queryFn !== "function")
			throw new Error("queryFn must be a function");
		const signal = new AbortController().signal;
		await queryFn({
			client: new QueryClient(),
			queryKey: options.queryKey,
			signal,
			meta: undefined,
			pageParam: 20,
		} as unknown as Parameters<typeof queryFn>[0]);
		expect(searchSemantic).toHaveBeenCalledWith(
			{
				text: "猫",
				mediaSourceId: "source-3",
				topK: 50,
				limit: 200,
				offset: 20,
			},
			signal,
		);
		expect(searchMedia).not.toHaveBeenCalled();
		expect(options.placeholderData).toBeUndefined();
	});
	it("builds a source-scoped key and forwards paged search input", async () => {
		const searchMedia = vi.fn(
			async (): Promise<MediaSearchResponse> => EMPTY_RESPONSE,
		);
		const options = buildSourceMediaResultsQueryOptions({
			sourceId: "source-3",
			condition: TEST_CONDITION,
			conditionKey: "source-condition",
			sort: "size",
			order: "desc",
			limit: 200,
			searchMedia,
			enabled: true,
		});

		expect(options.queryKey).toEqual([
			"media",
			"source-3",
			{
				sourceId: "source-3",
				conditionKey: "source-condition",
				sort: "size",
				order: "desc",
				limit: 200,
			},
		]);
		expect(options.initialPageParam).toBe(0);
		expect(options.enabled).toBe(true);
		expect(options.staleTime).toBe(MEDIA_RESULTS_STALE_TIME_MS);

		const queryFn = options.queryFn;
		if (typeof queryFn !== "function") {
			throw new Error("queryFn must be a function");
		}
		const signal = new AbortController().signal;
		await queryFn({
			client: new QueryClient(),
			queryKey: options.queryKey,
			signal,
			meta: undefined,
			pageParam: 400,
		} as unknown as Parameters<typeof queryFn>[0]);

		expect(searchMedia).toHaveBeenCalledWith(
			"source-3",
			{
				condition: TEST_CONDITION,
				sort: "size",
				order: "desc",
				limit: 200,
				offset: 400,
			},
			signal,
		);
	});

	it("uses loaded media count as the next source offset", () => {
		const options = buildSourceMediaResultsQueryOptions({
			sourceId: "source-3",
			condition: undefined,
			conditionKey: "null",
			sort: undefined,
			order: "desc",
			limit: 1,
			searchMedia: async () => EMPTY_RESPONSE,
		});
		const getNextPageParam = options.getNextPageParam;
		if (!getNextPageParam) {
			throw new Error("getNextPageParam must be defined");
		}
		const firstPage = { media: [TEST_MEDIA], total: 2 };
		const secondPage = { media: [TEST_MEDIA], total: 2 };

		expect(getNextPageParam(firstPage, [firstPage], 0, [0])).toBe(1);
		expect(
			getNextPageParam(secondPage, [firstPage, secondPage], 1, [0, 1]),
		).toBeUndefined();
	});

	it("rejects execution when the source ID is unavailable", async () => {
		const searchMedia = vi.fn(
			async (): Promise<MediaSearchResponse> => EMPTY_RESPONSE,
		);
		const options = buildSourceMediaResultsQueryOptions({
			sourceId: undefined,
			condition: undefined,
			conditionKey: "null",
			sort: undefined,
			order: "desc",
			limit: 200,
			searchMedia,
			enabled: false,
		});
		const queryFn = options.queryFn;
		if (typeof queryFn !== "function") {
			throw new Error("queryFn must be a function");
		}

		await expect(
			queryFn({
				client: new QueryClient(),
				queryKey: options.queryKey,
				signal: new AbortController().signal,
				meta: undefined,
				pageParam: 0,
			} as unknown as Parameters<typeof queryFn>[0]),
		).rejects.toThrow("Media source ID is required");
		expect(options.enabled).toBe(false);
		expect(searchMedia).not.toHaveBeenCalled();
	});
});
