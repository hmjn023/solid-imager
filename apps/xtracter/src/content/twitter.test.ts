import { describe, expect, it } from "vite-plus/test";
import { extractTwitterAuthorIdFromStatusUrl } from "./twitter";

describe("extractTwitterAuthorIdFromStatusUrl", () => {
	it("extracts the handle from an X status permalink", () => {
		expect(
			extractTwitterAuthorIdFromStatusUrl(
				"https://x.com/Creator_123/status/1234567890",
			),
		).toBe("@Creator_123");
	});

	it("extracts the handle from a legacy Twitter status permalink", () => {
		expect(
			extractTwitterAuthorIdFromStatusUrl(
				"https://twitter.com/creator/status/1234567890?s=20",
			),
		).toBe("@creator");
	});

	it("rejects status URLs that do not contain an account handle", () => {
		expect(
			extractTwitterAuthorIdFromStatusUrl(
				"https://x.com/i/web/status/1234567890",
			),
		).toBe("");
	});

	it("does not interpret display-name mentions as account IDs", () => {
		expect(
			extractTwitterAuthorIdFromStatusUrl(
				"https://x.com/not-a-status/display-name-@C107",
			),
		).toBe("");
	});
});
