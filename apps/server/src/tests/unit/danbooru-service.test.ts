import { describe, expect, it, vi } from "vitest";
import {
	createDanbooruService,
	DanbooruRequestError,
} from "~/infrastructure/services/danbooru-service";

function requestUrl(value: Parameters<typeof fetch>[0]): URL {
	if (value instanceof URL) return value;
	return new URL(typeof value === "string" ? value : value.url);
}

const remotePost = {
	id: 123,
	file_url: "https://cdn.donmai.us/original/123.png",
	preview_file_url: "https://cdn.donmai.us/preview/123.jpg",
	large_file_url: "https://cdn.donmai.us/sample/123.jpg",
	file_ext: "png",
	image_width: 1000,
	image_height: 800,
	file_size: 512,
	rating: "g",
	score: 10,
	created_at: "2026-01-01T00:00:00+00:00",
	source: "https://example.org/art/123",
	tag_string_artist: "artist_one artist_two",
	tag_string_character: "character",
	tag_string_copyright: "series",
	tag_string_general: "landscape blue_sky",
	tag_string_meta: "highres",
};

describe("Danbooru service", () => {
	it("encodes tag expressions, preserves categories, and applies pagination", async () => {
		const fetchRemote = vi
			.fn<typeof fetch>()
			.mockResolvedValue(Response.json([remotePost]));
		const service = createDanbooruService({
			fetch: fetchRemote,
			wait: async () => undefined,
		});
		const result = await service.search({
			tags: "landscape -monochrome order:score",
			page: 2,
			limit: 1,
		});
		const url = requestUrl(fetchRemote.mock.calls[0][0]);
		expect(url.origin).toBe("https://danbooru.donmai.us");
		expect(url.pathname).toBe("/posts.json");
		expect(url.searchParams.get("tags")).toBe(
			"landscape -monochrome order:score",
		);
		expect(url.searchParams.get("page")).toBe("2");
		expect(result.hasNextPage).toBe(true);
		expect(result.posts[0]).toMatchObject({
			id: 123,
			fileUrl: remotePost.file_url,
			tags: {
				artist: ["artist_one", "artist_two"],
				general: ["landscape", "blue_sky"],
				character: ["character"],
				copyright: ["series"],
			},
		});
	});

	it("coalesces concurrent tag requests and caches their results", async () => {
		const fetchRemote = vi
			.fn<typeof fetch>()
			.mockResolvedValue(
				Response.json([{ name: "blue_sky", category: 0, post_count: 100 }]),
			);
		const service = createDanbooruService({
			fetch: fetchRemote,
			wait: async () => undefined,
		});
		const [first, second] = await Promise.all([
			service.suggestTags("blue"),
			service.suggestTags("blue"),
		]);
		expect(first).toEqual([{ name: "blue_sky", category: 0, postCount: 100 }]);
		expect(second).toEqual(first);
		await service.suggestTags("blue");
		expect(fetchRemote).toHaveBeenCalledTimes(1);
		const url = requestUrl(fetchRemote.mock.calls[0][0]);
		expect(url.searchParams.get("search[name_or_alias_matches]")).toBe("blue*");
		expect(url.searchParams.get("search[order]")).toBe("count");
	});

	it("keeps inaccessible media unavailable and rejects foreign media hosts", async () => {
		const fetchRemote = vi.fn<typeof fetch>().mockResolvedValue(
			Response.json({
				...remotePost,
				file_url: null,
				large_file_url: "https://attacker.test/image.jpg",
				preview_file_url: "http://127.0.0.1/secret",
			}),
		);
		const service = createDanbooruService({
			fetch: fetchRemote,
			wait: async () => undefined,
		});
		expect(await service.getPost(123)).toMatchObject({
			id: 123,
			fileUrl: null,
			sampleUrl: null,
			previewUrl: null,
		});
	});

	it("allows retry after a rate limit and does not cache errors", async () => {
		const fetchRemote = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(new Response("slow down", { status: 429 }))
			.mockResolvedValueOnce(Response.json([]));
		const service = createDanbooruService({
			fetch: fetchRemote,
			wait: async () => undefined,
		});
		await expect(
			service.search({ tags: "", page: 1, limit: 40 }),
		).rejects.toMatchObject({ status: 429 });
		expect(await service.search({ tags: "", page: 1, limit: 40 })).toEqual({
			posts: [],
			hasNextPage: false,
		});
	});

	it("keeps optional credentials in the Authorization header", async () => {
		const fetchRemote = vi
			.fn<typeof fetch>()
			.mockResolvedValue(Response.json([remotePost]));
		const service = createDanbooruService({
			fetch: fetchRemote,
			wait: async () => undefined,
			login: "test-user",
			apiKey: "test-key",
		});
		await service.search({ tags: "", page: 1, limit: 40 });
		const [url, options] = fetchRemote.mock.calls[0];
		expect(requestUrl(url).href).not.toContain("test-key");
		expect(new Headers(options?.headers).get("Authorization")).toBe(
			`Basic ${Buffer.from("test-user:test-key").toString("base64")}`,
		);
	});

	it("turns connection failures into a recoverable upstream error", async () => {
		const fetchRemote = vi
			.fn<typeof fetch>()
			.mockRejectedValue(new Error("fetch failed"));
		const service = createDanbooruService({
			fetch: fetchRemote,
			wait: async () => undefined,
		});
		await expect(service.getPost(123)).rejects.toBeInstanceOf(
			DanbooruRequestError,
		);
	});
});
