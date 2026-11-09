import { describe, expect, it } from "vitest";
import { downloadItemSchema } from "../media/schemas";
import { danbooruPostToDownloadItem } from "./import";
import { getDanbooruPreview } from "./media";
import { danbooruMediaUrlSchema, danbooruPostSchema } from "./schemas";

const post = danbooruPostSchema.parse({
	id: 123,
	previewUrl: null,
	sampleUrl: null,
	fileUrl: "https://cdn.donmai.us/original/123.png",
	fileExt: "png",
	width: 1000,
	height: 800,
	fileSize: 512,
	rating: "g",
	score: 10,
	createdAt: "2026-01-01T00:00:00Z",
	source: "https://example.org/art/123",
	tags: {
		artist: ["artist_one", "artist_two"],
		character: ["character"],
		copyright: ["series"],
		general: ["blue_sky"],
		meta: ["highres"],
	},
});

describe("Danbooru import metadata", () => {
	it("previews animation video samples without treating the original ZIP as an image", () => {
		const video = "https://cdn.donmai.us/sample/123.webm";
		expect(
			getDanbooruPreview({ ...post, fileExt: "zip", sampleUrl: video }),
		).toEqual({ url: video, type: "video" });
		expect(
			getDanbooruPreview({ ...post, fileExt: "swf", sampleUrl: null }),
		).toBeNull();
		expect(getDanbooruPreview(post)).toEqual({
			url: post.fileUrl,
			type: "image",
		});
	});
	it("uses the original, preserves categorized metadata, and passes the import contract", () => {
		const item = downloadItemSchema.parse(danbooruPostToDownloadItem(post));
		expect(item.targetUrl).toBe(post.fileUrl);
		expect(item.sourceUrls).toEqual([
			post.fileUrl,
			post.source,
			"https://danbooru.donmai.us/posts/123",
		]);
		expect(item.authors).toHaveLength(2);
		expect(item.characters?.[0].name).toBe("character");
		expect(item.ips?.[0].name).toBe("series");
		expect(item.tags?.map((tag) => tag.name)).toEqual(["blue_sky", "highres"]);
	});
	it("does not enqueue samples when the original is unavailable", () => {
		expect(
			danbooruPostToDownloadItem({
				...post,
				fileUrl: null,
				sampleUrl: "https://cdn.donmai.us/sample/123.jpg",
			}),
		).toBeNull();
		expect(danbooruPostToDownloadItem({ ...post, fileExt: "zip" })).toBeNull();
	});
	it("only accepts HTTPS Danbooru media hosts without credentials or custom ports", () => {
		for (const url of [
			"http://cdn.donmai.us/123.jpg",
			"https://cdn.donmai.us.attacker.test/123.jpg",
			"https://user:password@cdn.donmai.us/123.jpg",
			"https://cdn.donmai.us:8080/123.jpg",
		])
			expect(danbooruMediaUrlSchema.safeParse(url).success).toBe(false);
	});
});
