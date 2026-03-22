import type { SearchGroup } from "@solid-imager/core/domain/media/schemas";
import { calculateNextModeState } from "@solid-imager/core/domain/search/logic";
import {
	defaultState,
	type SearchState,
} from "@solid-imager/core/domain/search/schema";

describe("calculateNextModeState - Pro to Simple transition", () => {
	it("should clear simple state when transitioning from empty Pro condition", () => {
		// Setup: Pro mode with empty condition, but STALE simple state
		const currentState: SearchState = {
			...defaultState,
			mode: "pro",
			advancedCondition: {
				type: "group",
				operator: "and",
				children: [],
			},
			// Stale data that should be cleared
			selectedTags: ["stale-tag"],
			searchQuery: "stale-query",
		};

		const nextState = calculateNextModeState(currentState, "simple");

		expect(nextState.mode).toBe("simple");
		// Empty advancedCondition should result in cleared simple state
		expect(nextState.selectedTags).toEqual([]);
		expect(nextState.searchQuery).toBe("");
	});

	it("should clear stale state when transitioning from complex Pro condition", () => {
		// Setup: Pro mode with COMPLEX condition (OR operator, cannot be represented in simple mode)
		const complexGroup: SearchGroup = {
			type: "group",
			operator: "or",
			children: [
				{ type: "criterion", target: "tag", operator: "equals", value: "tag1" },
				{ type: "criterion", target: "tag", operator: "equals", value: "tag2" },
			],
		};

		const currentState: SearchState = {
			...defaultState,
			mode: "pro",
			advancedCondition: complexGroup,
			// Stale data
			selectedTags: ["stale-tag"],
			searchQuery: "stale-query",
		};

		const nextState = calculateNextModeState(currentState, "simple");

		expect(nextState.mode).toBe("simple");
		// Should explicitly clear stale state
		expect(nextState.selectedTags).toEqual([]);
		expect(nextState.searchQuery).toBe("");
		expect(nextState.advancedCondition).toBeNull();
	});

	it("should restore simple state when transitioning from compatible Pro condition", () => {
		// Setup: Pro mode with condition that CAN be represented in simple mode
		const compatibleGroup: SearchGroup = {
			type: "group",
			operator: "and",
			children: [
				{
					type: "criterion",
					target: "fileName",
					operator: "contains",
					value: "test",
				},
				{ type: "criterion", target: "tag", operator: "equals", value: "tag1" },
			],
		};

		const currentState: SearchState = {
			...defaultState,
			mode: "pro",
			advancedCondition: compatibleGroup,
			// Stale data
			selectedTags: ["stale-tag"],
			searchQuery: "stale-query",
		};

		const nextState = calculateNextModeState(currentState, "simple");

		expect(nextState.mode).toBe("simple");
		// Should restore from advancedCondition
		expect(nextState.searchQuery).toBe("test");
		expect(nextState.selectedTags).toEqual(["tag1"]);
	});
});

describe("calculateNextModeState - Simple to Pro transition", () => {
	it("should populate advancedCondition from simple state", () => {
		const currentState: SearchState = {
			...defaultState,
			mode: "simple",
			searchQuery: "test",
			selectedTags: ["tag1", "tag2"],
		};

		const nextState = calculateNextModeState(currentState, "pro");

		expect(nextState.mode).toBe("pro");
		expect(nextState.advancedCondition).toEqual({
			type: "group",
			operator: "and",
			children: [
				{
					type: "criterion",
					target: "fileName",
					operator: "contains",
					value: "test",
				},
				{ type: "criterion", target: "tag", operator: "equals", value: "tag1" },
				{ type: "criterion", target: "tag", operator: "equals", value: "tag2" },
			],
		});
	});

	it("should set advancedCondition to null when simple state is empty", () => {
		const currentState: SearchState = {
			...defaultState,
			mode: "simple",
		};

		const nextState = calculateNextModeState(currentState, "pro");

		expect(nextState.mode).toBe("pro");
		expect(nextState.advancedCondition).toBeNull();
	});
});
