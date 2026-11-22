import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadItemSchema, type DownloadItem } from "@ext/schema";
import {
	getDanbooruPageMetadata,
	parseDanbooruApiMetadata,
	processDanbooruMedia,
} from "./danbooru";

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
				file_url: "https://cdn.donmai.us/original/image.png",
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
				file_url: "https://cdn.donmai.us/original/image.png",
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
				file_url: "https://cdn.donmai.us/original/image.png",
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

const POST_URL = "https://danbooru.donmai.us/posts/100";
const ORIGINAL_URL = "https://cdn.donmai.us/original/ab/cd/full.png";
const SAMPLE_URL = "https://cdn.donmai.us/sample/ab/cd/sample-full.jpg";
const PREVIEW_URL = "https://cdn.donmai.us/180x180/ab/cd/abcde.jpg";
const SOURCE_URL = "https://x.com/creator/status/123";
const CREATED_AT = "2026-11-01T00:00:00Z";

function fixtureContainer() {
	return {
		classList: { add: vi.fn() },
		style: { position: "static" },
		appendChild: vi.fn(),
		isConnected: true,
	};
}

function mockPage(url: string) {
	const location = { href: url };
	vi.stubGlobal("navigator", { userAgent: "fixture" });
	vi.stubGlobal("window", {
		location,
		getComputedStyle: () => ({ position: "static" }),
	});
	const controls: (() => Promise<DownloadItem | null>)[] = [];
	const createButton = vi.fn(
		(getMetadata: () => Promise<DownloadItem | null>) => {
			controls.push(getMetadata);
			return {} as HTMLDivElement;
		},
	);
	return { location, controls, createButton };
}

function mockDetailPage(fileUrl: string | null = ORIGINAL_URL) {
	const page = mockPage(POST_URL);
	const tagList = new Map([
		[0, "blue_sky"],
		[1, "artist_name"],
		[3, "some_series"],
		[4, "main_character"],
		[5, "high_res"],
	]);
	const container = {
		...fixtureContainer(),
		getAttribute: (name: string) =>
			({
				"data-file-url": fileUrl,
				"data-id": "100",
				"data-source": SOURCE_URL,
			})[name] ?? null,
		querySelector: (selector: string) =>
			selector === "#image" ? { src: SAMPLE_URL } : null,
	};
	vi.stubGlobal("document", {
		title: "Danbooru fixture",
		querySelector: (selector: string) => {
			if (selector.startsWith(".image-container")) return container;
			if (selector === "#post-info-date time") return { dateTime: CREATED_AT };
			if (selector === 'meta[property="og:image"]')
				return { content: PREVIEW_URL };
			if (selector === "#tag-list") {
				return {
					querySelectorAll: (tagSelector: string) => {
						const category = Number(tagSelector.match(/\.tag-type-(\d+)/)?.[1]);
						const tagName = tagList.get(category);
						return tagName
							? [
									{
										dataset: { tagName },
										textContent: tagName.replaceAll("_", " "),
									},
								]
							: [];
					},
				};
			}
			return null;
		},
		querySelectorAll: (selector: string) =>
			selector === "#post-info-source a"
				? [{ href: "https://x.com/unrelated/status/999" }]
				: [],
	});
	return page;
}

function apiPost(id: number, url = ORIGINAL_URL) {
	return {
		id,
		file_url: url,
		preview_file_url: PREVIEW_URL,
		large_file_url: SAMPLE_URL,
		source: SOURCE_URL,
		tag_string_artist: "artist_name",
		tag_string_copyright: "some_series",
		tag_string_character: "main_character",
		tag_string_general: "blue_sky",
		tag_string_meta: "high_res",
		created_at: CREATED_AT,
	};
}

describe("Danbooru page import metadata", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("uses the detail's original and canonical tags for the inline and popup actions", async () => {
		const { createButton, controls } = mockDetailPage();
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		processDanbooruMedia(createButton);
		const inline = await controls[0]();
		const popup = await getDanbooruPageMetadata();
		expect(popup).toEqual([inline]);
		expect(downloadItemSchema.array().parse(popup)[0].previewUrl).toBe(
			PREVIEW_URL,
		);
		expect(inline).toMatchObject({
			targetUrl: ORIGINAL_URL,
			previewUrl: PREVIEW_URL,
			sourceUrls: [ORIGINAL_URL, SOURCE_URL, POST_URL],
			createdAt: CREATED_AT,
			authors: [
				{ name: "artist_name", platform: "twitter", accountId: "@creator" },
			],
			characters: [{ name: "main_character", source: "danbooru" }],
			ips: [{ name: "some_series", source: "danbooru" }],
			tags: [
				{ name: "blue_sky", source: "danbooru", type: "positive" },
				{ name: "high_res", source: "danbooru", type: "positive" },
			],
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("looks up the original via the detail API when markup only has a sample", async () => {
		const { createButton, controls } = mockDetailPage(null);
		const fetchMock = vi.fn(async () => Response.json(apiPost(100)));
		vi.stubGlobal("fetch", fetchMock);
		processDanbooruMedia(createButton);
		expect(fetchMock).not.toHaveBeenCalled();

		expect((await controls[0]())?.targetUrl).toBe(ORIGINAL_URL);
		expect(fetchMock).toHaveBeenCalledWith(`${POST_URL}.json`, {
			credentials: "same-origin",
		});
		expect((await getDanbooruPageMetadata())[0]?.targetUrl).toBe(ORIGINAL_URL);
	});

	it.each([
		{ ...apiPost(100), file_url: null },
		apiPost(101),
		apiPost(100, "https://cdn.donmai.us.example/original/full.png"),
	])(
		"excludes a missing or invalid original instead of importing the sample",
		async (post) => {
			const { createButton, controls } = mockDetailPage(null);
			vi.stubGlobal(
				"fetch",
				vi.fn(async () => Response.json(post)),
			);
			processDanbooruMedia(createButton);
			expect(await controls[0]()).toBeNull();
			expect(await getDanbooruPageMetadata()).toEqual([]);
		},
	);

	it("fetches only current list cards and keeps thumbnail order and per-post buttons", async () => {
		const { createButton, controls, location } = mockPage(
			"https://danbooru.donmai.us/posts?page=2",
		);
		const otherUrl = ORIGINAL_URL.replace("full.png", "other.png");
		const cards = ["100", "101", "100", "../invalid"].map((id) => ({
			...fixtureContainer(),
			getAttribute: () => id,
			querySelector: () => fixtureContainer(),
		}));
		vi.stubGlobal("document", {
			querySelector: () => null,
			querySelectorAll: () => cards,
		});
		const fetchMock = vi.fn(async (url: string) =>
			Response.json(
				url.includes("/posts.json")
					? [apiPost(101, otherUrl), apiPost(999), apiPost(100)]
					: apiPost(101, otherUrl),
			),
		);
		vi.stubGlobal("fetch", fetchMock);
		processDanbooruMedia(createButton);
		expect(controls).toHaveLength(3);
		expect(fetchMock).not.toHaveBeenCalled();

		const items = await getDanbooruPageMetadata();
		expect(items.map((item) => item.targetUrl)).toEqual([
			ORIGINAL_URL,
			otherUrl,
		]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const batchUrl = new URL(fetchMock.mock.calls[0][0]);
		expect(batchUrl.pathname).toBe("/posts.json");
		expect(batchUrl.searchParams.get("tags")).toBe("id:100,101 status:any");
		expect(batchUrl.searchParams.get("limit")).toBe("2");
		expect(await controls[1]()).toEqual(items[1]);
		expect(items.map((item) => item.previewUrl)).toEqual([
			PREVIEW_URL,
			PREVIEW_URL,
		]);

		const pending = getDanbooruPageMetadata();
		location.href = "https://danbooru.donmai.us/posts?page=3";
		expect(await pending).toEqual([]);
	});
});
