import { describe, expect, it } from "vitest";
import {
	createMediaGroupSchema,
	sourcePostFromUrls,
	sourcePostSchema,
} from "./groups";
describe("source post identities", () => {
	it("normalizes X hosts and photo order without conflating adjacent posts", () => {
		expect(
			sourcePostFromUrls(["https://twitter.com/artist/status/123/photo/2?x=1"]),
		).toEqual({ platform: "twitter", postId: "123", position: 1 });
		expect(sourcePostFromUrls(["https://x.com/i/web/status/123"])).toEqual({
			platform: "twitter",
			postId: "123",
			position: null,
		});
		expect(sourcePostFromUrls(["https://x.com/a/status/124"])?.postId).toBe(
			"124",
		);
	});
	it("rejects profiles, timelines, unrelated hosts and malformed URLs", () => {
		for (const url of [
			"https://x.com/home",
			"https://x.com/artist",
			"https://evil.test/artist/status/123",
			"not a URL",
			"https://pbs.twimg.com/media/123.jpg",
			"javascript:alert(1)",
		])
			expect(sourcePostFromUrls([url])).toBeUndefined();
	});
	it("recognizes Pixiv and FANBOX permalinks", () => {
		expect(
			sourcePostFromUrls(["https://www.pixiv.net/en/artworks/123"])?.platform,
		).toBe("pixiv");
		expect(
			sourcePostFromUrls(["https://artist.fanbox.cc/posts/123"])?.platform,
		).toBe("fanbox");
	});
	it("validates explicit positions and distinct group members", () => {
		expect(
			sourcePostSchema.safeParse({
				platform: "pixiv",
				postId: "1",
				position: -1,
			}).success,
		).toBe(false);
		const id = "11111111-1111-4111-8111-111111111111";
		expect(
			createMediaGroupSchema.safeParse({
				title: "Comic",
				kind: "comic",
				mediaIds: [id, id],
			}).success,
		).toBe(false);
	});
});
