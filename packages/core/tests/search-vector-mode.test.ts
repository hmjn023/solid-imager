import { describe, expect, it } from "vite-plus/test";
import { calculateNextModeState } from "../src/domain/search/logic";
import { defaultState } from "../src/domain/search/schema";
import {
	ccipDistancesRequestSchema,
} from "../src/domain/tagging/schemas";

describe("vector search mode transitions", () => {
	it("restores preserved simple filters when leaving vector mode", () => {
		const vectorState = {
			...defaultState,
			mode: "vector" as const,
			searchQuery: "preserved query",
			selectedTags: ["tag-1"],
			similarityAnchorMediaId: "00000000-0000-4000-8000-000000000001",
		};

		expect(calculateNextModeState(vectorState, "simple")).toEqual({
			mode: "simple",
			offset: 0,
			scrollY: 0,
		});
	});

	it("restores preserved advanced conditions when leaving vector mode", () => {
		const vectorState = {
			...defaultState,
			mode: "vector" as const,
			advancedCondition: {
				type: "group" as const,
				operator: "and" as const,
				children: [],
			},
		};

		expect(calculateNextModeState(vectorState, "pro")).toEqual({
			mode: "pro",
			offset: 0,
			scrollY: 0,
		});
	});
});

describe("CCIP distance request validation", () => {
	it("rejects candidates with dimensions different from the feature", () => {
		const result = ccipDistancesRequestSchema.safeParse({
			feature: [1, 2, 3],
			candidates: [[1, 2]],
		});

		expect(result.success).toBe(false);
	});

	it("accepts candidates with matching dimensions", () => {
		const result = ccipDistancesRequestSchema.safeParse({
			feature: [1, 2, 3],
			candidates: [
				[1, 2, 3],
				[4, 5, 6],
			],
		});

		expect(result.success).toBe(true);
	});
});
