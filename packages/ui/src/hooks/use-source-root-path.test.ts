import { describe, expect, it } from "vitest";
import { createStaticSourceRootPath } from "./use-source-root-path";

describe("createStaticSourceRootPath", () => {
	it("returns a resolver that returns the given path", () => {
		const resolver = createStaticSourceRootPath("/test/path");
		expect(resolver("any-id")).toBe("/test/path");
	});

	it("returns a resolver that returns undefined when path is undefined", () => {
		const resolver = createStaticSourceRootPath(undefined);
		expect(resolver("any-id")).toBeUndefined();
	});
});
