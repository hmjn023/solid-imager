import { describe, expect, it } from "vitest";
import { completeDanbooruTag, getDanbooruCompletion } from "./completion";

describe("Danbooru tag completion", () => {
	it("completes the active tag while keeping existing filters and exclusion", () => {
		const draft = "rating:g -blue";
		expect(getDanbooruCompletion(draft)).toMatchObject({
			query: "blue",
			prefix: "-",
		});
		expect(completeDanbooruTag(draft, draft.length, "blue_sky")).toBe(
			"rating:g -blue_sky ",
		);
	});
	it("replaces a tag at the caret without deleting following tags", () => {
		expect(completeDanbooruTag("cat bl dog", 6, "blue_sky")).toBe(
			"cat blue_sky dog",
		);
	});
	it("accepts pasted whitespace separators while editing a term", () => {
		const draft = "cat　-bl\tdog";
		expect(getDanbooruCompletion(draft, 7)).toMatchObject({
			query: "bl",
			prefix: "-",
		});
		expect(completeDanbooruTag(draft, 7, "blue_sky")).toBe(
			"cat　-blue_sky dog",
		);
	});
	it("keeps an OR operator and avoids requesting metatag values", () => {
		expect(completeDanbooruTag("~bl", 3, "blue_sky")).toBe("~blue_sky ");
		expect(getDanbooruCompletion("cat rating:g").query).toBe("");
		expect(getDanbooruCompletion("cat ").query).toBe("");
	});
});
