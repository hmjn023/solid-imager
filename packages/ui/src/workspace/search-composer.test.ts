import { defaultState } from "@solid-imager/core/domain/search/schema";
import { describe, expect, it } from "vitest";
import type { SearchPageFilterData } from "../hooks/use-search-page";
import {
	getSearchComposerSuggestions,
	getSearchComposerTokens,
	parseSimilarityAnchor,
	parseSimilarityTopK,
	type SearchToken,
} from "./search-composer-utils";

const filterData = {
	tags: [{ name: "blue hair" }, { name: "blush" }, { name: "green" }],
	ips: [{ name: "Idolmaster" }],
	characters: [{ name: "Hoshino Ai" }],
	authors: [{ name: "Artist", accountId: "artist_01" }],
	projects: [{ name: "Summer collection" }],
} as SearchPageFilterData;

describe("getSearchComposerSuggestions", () => {
	it("maps each relation prefix to its selected state key", () => {
		expect(getSearchComposerSuggestions("tag:blue", filterData, [])).toEqual([
			{
				key: "selectedTags",
				label: "blue hair",
				prefix: "tag",
				value: "blue hair",
			},
		]);
		expect(getSearchComposerSuggestions("-tag:", filterData, [])[0]?.key).toBe(
			"excludeTags",
		);
		expect(getSearchComposerSuggestions("ip:ido", filterData, [])[0]?.key).toBe(
			"selectedIps",
		);
		expect(
			getSearchComposerSuggestions("character:ai", filterData, [])[0]?.key,
		).toBe("selectedCharacters");
		expect(
			getSearchComposerSuggestions("author:artist", filterData, [])[0]?.label,
		).toBe("Artist：artist_01");
		expect(
			getSearchComposerSuggestions("project:summer", filterData, [])[0]?.key,
		).toBe("selectedProjects");
	});

	it("matches case-insensitively and excludes selected values", () => {
		const tokens: SearchToken[] = [
			{ key: "selectedTags", prefix: "tag", value: "blue hair" },
		];

		expect(
			getSearchComposerSuggestions("tag:BLUE", filterData, tokens),
		).toEqual([]);
		expect(
			getSearchComposerSuggestions("tag:", filterData, tokens).map(
				(suggestion) => suggestion.value,
			),
		).toEqual(["blush", "green"]);
	});

	it("does not offer suggestions for free text or comma-separated values", () => {
		expect(getSearchComposerSuggestions("image", filterData, [])).toEqual([]);
		expect(
			getSearchComposerSuggestions("tag:blue,red", filterData, []),
		).toEqual([]);
	});
});

describe("parseSimilarityAnchor", () => {
	it("accepts UUID media IDs", () => {
		expect(parseSimilarityAnchor("11111111-1111-4111-8111-111111111111")).toBe(
			"11111111-1111-4111-8111-111111111111",
		);
	});

	it("rejects non-UUID values", () => {
		expect(parseSimilarityAnchor("not-a-media-id")).toBeUndefined();
	});
});

describe("getSearchComposerTokens", () => {
	it("exposes similarity ordering as similarity and limit tokens", () => {
		const state = {
			...defaultState,
			similarityAnchorMediaId: "11111111-1111-4111-8111-111111111111",
			similarityTopK: 37,
		};

		expect(getSearchComposerTokens(state)).toEqual([
			{
				key: "similarityAnchorMediaId",
				prefix: "similar",
				value: "11111111-1111-4111-8111-111111111111",
			},
			{
				key: "similarityTopK",
				prefix: "limit",
				value: "37",
				removable: false,
			},
		]);
	});

	it("does not expose similarity options when no anchor is set", () => {
		expect(getSearchComposerTokens(defaultState)).toEqual([]);
	});
});

describe("parseSimilarityTopK", () => {
	it("accepts arbitrary supported result sizes", () => {
		expect(parseSimilarityTopK("20")).toBe(20);
		expect(parseSimilarityTopK("50")).toBe(50);
		expect(parseSimilarityTopK("100")).toBe(100);
		expect(parseSimilarityTopK("37")).toBe(37);
	});

	it("rejects unsupported result sizes", () => {
		expect(parseSimilarityTopK("0")).toBeUndefined();
		expect(parseSimilarityTopK("200")).toBeUndefined();
		expect(parseSimilarityTopK("abc")).toBeUndefined();
	});
});
