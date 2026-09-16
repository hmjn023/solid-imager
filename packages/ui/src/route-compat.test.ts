import { describe, expect, it } from "vitest";
import { toCanonicalRouteHref } from "./route-compat";

describe("toCanonicalRouteHref", () => {
	it("preserves query strings and hashes for the retired root", () => {
		expect(toCanonicalRouteHref("/v2?tab=all#results")).toBe(
			"/search?tab=all#results",
		);
	});

	it("maps known nested source paths", () => {
		expect(
			toCanonicalRouteHref("/v2/sources/source-1/media-2?from=search#media"),
		).toBe("/sources/source-1/media-2?from=search#media");
	});

	it("does not turn protocol-relative-looking paths into redirects", () => {
		expect(toCanonicalRouteHref("/v2//example.com")).toBeNull();
	});

	it("leaves unknown paths for the normal not-found surface", () => {
		expect(toCanonicalRouteHref("/v2/unknown")).toBeNull();
		expect(toCanonicalRouteHref("/search")).toBeNull();
	});
});
