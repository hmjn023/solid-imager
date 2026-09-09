import { describe, expect, it } from "vitest";
import { toCanonicalLegacyHref } from "./route-compat";

describe("toCanonicalLegacyHref", () => {
	it("preserves query strings and hashes for the retired root", () => {
		expect(toCanonicalLegacyHref("/v2?tab=all#results")).toBe(
			"/search?tab=all#results",
		);
	});

	it("maps known nested source paths", () => {
		expect(
			toCanonicalLegacyHref("/v2/sources/source-1/media-2?from=search#media"),
		).toBe("/sources/source-1/media-2?from=search#media");
	});

	it("does not turn protocol-relative-looking paths into redirects", () => {
		expect(toCanonicalLegacyHref("/v2//example.com")).toBeNull();
	});

	it("leaves unknown paths for the normal not-found surface", () => {
		expect(toCanonicalLegacyHref("/v2/unknown")).toBeNull();
		expect(toCanonicalLegacyHref("/search")).toBeNull();
	});
});
