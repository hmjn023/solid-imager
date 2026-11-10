import {
	calculateNextModeState,
	defaultState,
	type SearchState,
} from "@solid-imager/core/search";
import { describe, expect, it } from "vitest";
import {
	getSearchConditionCount,
	getSearchExecutionKind,
} from "./search-execution";
import { getSearchComposerTokens } from "./workspace/search-composer-utils";

describe("applied search display", () => {
	const retained: SearchState = {
		...defaultState,
		selectedTags: ["blue hair"],
		searchQuery: "filename",
	};
	it("does not label retained normal conditions as applied similarity filters", () => {
		const similar = {
			...retained,
			similarityAnchorMediaId: "11111111-1111-4111-8111-111111111111",
		};
		expect(getSearchExecutionKind(similar)).toBe("similarity");
		expect(getSearchComposerTokens(similar).map((token) => token.key)).toEqual([
			"similarityAnchorMediaId",
			"similarityTopK",
		]);
		expect(
			getSearchComposerTokens({
				...similar,
				similarityAnchorMediaId: null,
			}).map((token) => token.key),
		).toEqual(["searchQuery", "selectedTags"]);
	});
	it("uses semantic precedence and ignores blank semantic text consistently", () => {
		expect(
			getSearchExecutionKind({
				semanticQuery: "  ",
				similarityAnchorMediaId: "anchor",
			}),
		).toBe("similarity");
		expect(
			getSearchComposerTokens({
				...retained,
				semanticQuery: "  a cat  ",
				similarityAnchorMediaId: "anchor",
			}),
		).toEqual([{ key: "semanticQuery", prefix: "文章", value: "a cat" }]);
	});
	it("keeps simple/pro formatting independent of semantic or similarity execution", () => {
		for (const state of [
			{ ...retained, semanticQuery: "a cat" },
			{ ...retained, similarityAnchorMediaId: "anchor" },
		]) {
			const pro = { ...state, ...calculateNextModeState(state, "pro") };
			expect(getSearchExecutionKind(pro)).toBe(getSearchExecutionKind(state));
			expect(getSearchConditionCount(pro)).toBe(2);
		}
	});
	it("counts and displays the current pro expression without showing stale simple tokens", () => {
		const pro: SearchState = {
			...retained,
			mode: "pro",
			advancedCondition: {
				type: "group",
				operator: "or",
				children: [
					{
						type: "criterion",
						target: "favorite",
						operator: "equals",
						value: true,
					},
				],
			},
		};
		expect(getSearchConditionCount(pro)).toBe(1);
		expect(getSearchComposerTokens(pro)).toEqual([]);
	});
});
