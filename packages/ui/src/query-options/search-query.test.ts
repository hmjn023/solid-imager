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
});

describe("buildSearchResultsQueryOptions", () => {
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
			pageParam: 80,
			direction: "forward",
		});

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

	it("forwards vector search input and disables pagination", async () => {
		const response = { media: [TEST_MEDIA], total: 10 };
		const searchMedia = vi.fn(
			async (): Promise<MediaSearchResponse> => EMPTY_RESPONSE,
		);
		const searchSimilar = vi.fn(
			async (): Promise<MediaSearchResponse> => response,
		);
		const options = buildSearchResultsQueryOptions({
			mode: "vector",
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
				direction: "forward",
			}),
		).resolves.toEqual(response);
		expect(searchSimilar).toHaveBeenCalledWith(
			{
				anchorMediaId: "anchor-media",
				mediaSourceId: "source-2",
				topK: 10,
			},
			signal,
		);
		expect(searchMedia).not.toHaveBeenCalled();

		const getNextPageParam = options.getNextPageParam;
		if (!getNextPageParam) {
			throw new Error("getNextPageParam must be defined");
		}
		expect(getNextPageParam(response, [response], 0, [0])).toBeUndefined();
	});

	it("returns an empty result when vector search requirements are absent", async () => {
		const searchMedia = vi.fn(
			async (): Promise<MediaSearchResponse> => EMPTY_RESPONSE,
		);
		const options = buildSearchResultsQueryOptions({
			mode: "vector",
			sourceId: undefined,
			condition: undefined,
			conditionKey: "null",
			sort: undefined,
			order: "desc",
			limit: 100,
			similarityAnchorMediaId: null,
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
				direction: "forward",
			}),
		).resolves.toEqual(EMPTY_RESPONSE);
		expect(options.enabled).toBe(false);
		expect(searchMedia).not.toHaveBeenCalled();
	});
});

describe("buildSourceMediaResultsQueryOptions", () => {
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
			direction: "forward",
		});

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
				direction: "forward",
			}),
		).rejects.toThrow("Media source ID is required");
		expect(options.enabled).toBe(false);
		expect(searchMedia).not.toHaveBeenCalled();
	});
});
