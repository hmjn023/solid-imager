import { describe, expect, it } from "vitest";
import { searchQueryKeys, sourceMediaQueryKeys } from "./search-query";

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
		});
		expect(key.slice(0, 2)).toEqual(sourceMediaQueryKeys.forSource("source"));
	});
});
