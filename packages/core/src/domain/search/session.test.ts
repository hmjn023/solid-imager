import { describe, expect, it } from "vitest";
import { defaultState, type SearchState } from "./schema";
import { decodeSearchSession, encodeSearchSession } from "./session";

describe("search session", () => {
	it("round-trips the condition, source, sort, and query modes independently of navigation state", () => {
		const state: SearchState = {
			...defaultState,
			mode: "pro",
			advancedCondition: {
				type: "group",
				operator: "or",
				negate: false,
				children: [
					{
						type: "criterion",
						target: "tag",
						operator: "equals",
						value: "cat",
						negate: false,
					},
					{
						type: "criterion",
						target: "tag",
						operator: "equals",
						value: "dog",
						negate: false,
					},
				],
			},
			selectedSource: "source-1",
			sortBy: "name",
			sortOrder: "asc",
			similarityAnchorMediaId: "11111111-1111-4111-8111-111111111111",
			similarityTopK: 30,
			similarityModel: "embeddinggemma2",
			semanticQuery: "animals",
			activePresetId: 42,
			scrollY: 200,
			offset: 20,
		};
		expect(decodeSearchSession(encodeSearchSession(state), "other")).toEqual({
			...state,
			activePresetId: null,
			scrollY: 0,
			offset: 0,
		});
	});

	it("restores legacy filters and defaults missing or invalid optional fields", () => {
		const stored = JSON.stringify({
			value: {
				type: "group",
				operator: "and",
				children: [
					{
						type: "criterion",
						target: "keyword",
						operator: "contains",
						value: "legacy",
					},
				],
			},
			similarityTopK: -10,
			similarityModel: "unknown",
			semanticQuery: 42,
		});
		expect(decodeSearchSession(stored, "fallback")).toEqual({
			...defaultState,
			searchQuery: "legacy",
			selectedSource: "fallback",
		});
	});

	it.each(["{broken", "null", "{}", '{"value":null}'])(
		"rejects an invalid session payload %s",
		(stored) => {
			expect(decodeSearchSession(stored, "")).toBeNull();
		},
	);
});
