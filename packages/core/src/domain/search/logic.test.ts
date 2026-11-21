import { describe, expect, it } from "vitest";
import { getSearchConditionFromState } from "./logic";
import { defaultState } from "./schema";
import type { SearchGroup } from "./criteria";

describe("unfinished advanced numeric criteria", () => {
	it("omits empty numeric values recursively while keeping zero and explicit empty checks", () => {
		const expected: SearchGroup = {
			type: "group",
			operator: "or",
			children: [
				{ type: "criterion", target: "rating", operator: "equals", value: 0 },
				{
					type: "criterion",
					target: "width",
					operator: "isEmpty",
					value: null,
				},
				{
					type: "criterion",
					target: "height",
					operator: "isNotEmpty",
					value: null,
				},
			],
		};
		const advancedCondition: SearchGroup = {
			...expected,
			children: [
				...expected.children,
				{
					type: "criterion",
					target: "rating",
					operator: "equals",
					value: null,
				},
				{
					type: "group",
					operator: "and",
					negate: true,
					children: [
						{
							type: "criterion",
							target: "fileSize",
							operator: "gte",
							value: "",
						},
					],
				},
			],
		};
		expect(
			getSearchConditionFromState({
				...defaultState,
				mode: "pro",
				advancedCondition,
			}),
		).toEqual(expected);
		expect(advancedCondition.children).toHaveLength(5);
	});
	it("does not send a condition when all numeric inputs are empty", () => {
		expect(
			getSearchConditionFromState({
				...defaultState,
				mode: "pro",
				advancedCondition: {
					type: "group",
					operator: "and",
					children: [
						{
							type: "criterion",
							target: "rating",
							operator: "equals",
							value: null,
						},
					],
				},
			}),
		).toBeUndefined();
	});
});
