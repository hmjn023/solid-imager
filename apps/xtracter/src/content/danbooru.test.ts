import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseDanbooruApiMetadata } from "./danbooru";

describe("Danbooru artist identities", () => {
	beforeEach(() => {
		vi.stubGlobal("navigator", { userAgent: "fixture" });
		vi.stubGlobal("document", {
			querySelectorAll: () => [{ href: "https://x.com/unrelated/status/999" }],
		});
	});
	afterEach(() => vi.unstubAllGlobals());
	it("does not assign one source account to several artists", () => {
		const item = parseDanbooruApiMetadata(
			{
				file_url: "https://cdn.example.com/image.png",
				source: "https://x.com/creator/status/123",
				tag_string_artist: "artist_one artist_two",
			},
			"100",
		);
		expect(item?.authors).toEqual([
			{ name: "artist_one", platform: "danbooru", accountId: "artist_one" },
			{ name: "artist_two", platform: "danbooru", accountId: "artist_two" },
		]);
	});
	it("uses only the requested post sources for a preview, ignoring the surrounding page", () => {
		const item = parseDanbooruApiMetadata(
			{
				file_url: "https://cdn.example.com/image.png",
				tag_string_artist: "artist",
			},
			"100",
		);
		expect(item?.authors).toEqual([
			{ name: "artist", platform: "danbooru", accountId: "artist" },
		]);
		expect(item?.sourceUrls).not.toContain(
			"https://x.com/unrelated/status/999",
		);
	});
	it("retains the source handle for a single artist without inventing a fixed ID", () => {
		const item = parseDanbooruApiMetadata(
			{
				file_url: "https://cdn.example.com/image.png",
				source: "https://x.com/creator/status/123",
				tag_string_artist: "artist",
			},
			"100",
		);
		expect(item?.authors).toEqual([
			{ name: "artist", platform: "twitter", accountId: "@creator" },
		]);
	});
});
