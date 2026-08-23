import { describe, expect, it } from "vitest";
import { resolveEffectiveSourceId } from "./source-selection";

const sources = [
	{ id: "alpha-id", name: "alpha" },
	{ id: "twitter-id", name: "twitter" },
	{ id: "beta-id", name: "beta" },
];

describe("resolveEffectiveSourceId", () => {
	it("returns null when the source list is empty", () => {
		expect(resolveEffectiveSourceId([], "beta-id")).toBeNull();
	});

	it("keeps a valid preferred source", () => {
		expect(resolveEffectiveSourceId(sources, "beta-id")).toEqual(sources[2]);
	});

	it("falls back to the first source when the preferred id is missing", () => {
		expect(resolveEffectiveSourceId(sources, "deleted-id")).toEqual(sources[0]);
	});

	it("prefers the named fallback over the first source when no preferred id is given", () => {
		expect(resolveEffectiveSourceId(sources, null, "twitter")).toEqual(
			sources[1],
		);
	});

	it("prefers a valid preferred id over the named fallback", () => {
		expect(resolveEffectiveSourceId(sources, "beta-id", "twitter")).toEqual(
			sources[2],
		);
	});

	it("falls back to the first source when the named fallback is also absent", () => {
		expect(resolveEffectiveSourceId(sources, undefined, "unknown")).toEqual(
			sources[0],
		);
	});
});
