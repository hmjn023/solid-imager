import { describe, expect, it } from "vitest";
import type { SearchPageFilterData } from "../hooks/use-search-page";
import {
	getSearchComposerSuggestions,
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
