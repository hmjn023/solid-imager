import { downloadItemSchema, type DownloadItem } from "@ext/schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getPixivArtworkId,
	getPixivImagePage,
	parsePixivMetadata,
	processPixivMedia,
} from "./pixiv";

const artworkId = "123456789";
const artworkUrl = `https://www.pixiv.net/artworks/${artworkId}`;
const originalUrls = [
	`https://i.pximg.net/img-original/img/2026/11/01/00/00/00/${artworkId}_p0.jpg`,
	`https://i.pximg.net/img-original/img/2026/11/01/00/00/00/${artworkId}_p1_abcd.png`,
];
const ugoiraUrl = `https://i.pximg.net/img-zip-ugoira/img/2026/11/01/00/00/00/${artworkId}_ugoira1920x1080.zip`;

function ugoiraArtworkResponse() {
	const result = artworkResponse();
	result.body.illustType = 2;
	result.body.pageCount = 1;
	return result;
}

function ugoiraResponse() {
	return {
		error: false,
		body: {
			originalSrc: ugoiraUrl,
			src: ugoiraUrl.replace("1920x1080", "600x600"),
			mime_type: "image/jpeg",
			frames: [
				{ file: "000000.jpg", delay: 125 },
				{ file: "000001.jpg", delay: 250 },
			],
		},
	};
}

function artworkResponse() {
	return {
		error: false,
		body: {
			id: artworkId,
			illustType: 1,
			pageCount: 2,
			title: "作品タイトル",
			description: "作品の説明",
			userId: "98765",
			userName: "作者",
			createDate: "2026-11-01T00:00:00+09:00",
			tags: { tags: [{ tag: "オリジナル" }, { tag: "風景" }] },
		},
	};
}

function pagesResponse() {
	return {
		error: false,
		body: originalUrls.map((original) => ({ urls: { original } })),
	};
}

beforeEach(() => {
	vi.stubGlobal("navigator", { userAgent: "Pixiv fixture" });
	// Parsing is provided by the browser; these fixtures contain plain caption text.
	vi.stubGlobal(
		"DOMParser",
		class {
			parseFromString(text: string) {
				return { body: { textContent: text }, querySelectorAll: () => [] };
			}
		},
	);
});
afterEach(() => vi.unstubAllGlobals());

describe("Pixiv image metadata", () => {
	it.each([
		artworkUrl,
		`https://www.pixiv.net/en/artworks/${artworkId}?from=search#page`,
		`https://www.pixiv.net/ja/artworks/${artworkId}/`,
	])("recognizes the artwork permalink %s", (url) => {
		expect(getPixivArtworkId(url)).toBe(artworkId);
	});
	it.each([
		`https://www.pixiv.net.attacker.test/artworks/${artworkId}`,
		`http://www.pixiv.net/artworks/${artworkId}`,
		`https://www.pixiv.net/users/${artworkId}`,
		`https://www.pixiv.net/artworks/${artworkId}/other`,
	])("rejects non-artwork and non-Pixiv URL %s", (url) => {
		expect(getPixivArtworkId(url)).toBeNull();
	});
	it("preserves different original extensions and canonical artwork Referer for every page", () => {
		const items = parsePixivMetadata(
			artworkResponse(),
			pagesResponse(),
			artworkId,
		);
		expect(items?.map((item) => item.targetUrl)).toEqual(originalUrls);
		for (const [index, item] of (items ?? []).entries()) {
			expect(item.sourceUrls).toEqual([originalUrls[index], artworkUrl]);
			expect(item.authors).toEqual([
				expect.objectContaining({
					name: "作者",
					platform: "pixiv",
					accountId: "98765",
					remoteId: "98765",
					profileUrl: "https://www.pixiv.net/users/98765",
				}),
			]);
			expect(item.tags).toEqual([
				{ name: "オリジナル", type: "positive", source: "pixiv" },
				{ name: "風景", type: "positive", source: "pixiv" },
			]);
			expect(item.description).toBe("作品タイトル\n\n作品の説明");
			expect(item.createdAt).toBe("2026-11-01T00:00:00+09:00");
			expect(item.cookies).toBeUndefined();
		}
	});
	it("rejects failed or malformed Ajax results", () => {
		expect(
			parsePixivMetadata(
				{ error: true, body: null },
				pagesResponse(),
				artworkId,
			),
		).toBeNull();
		expect(
			parsePixivMetadata(
				artworkResponse(),
				{ error: false, body: [{}] },
				artworkId,
			),
		).toBeNull();
		expect(
			parsePixivMetadata(
				artworkResponse(),
				{ error: false, body: [] },
				artworkId,
			),
		).toBeNull();
	});
	it("rejects another artwork, incomplete pages, and ugoira instead of importing its poster", () => {
		expect(
			parsePixivMetadata(artworkResponse(), pagesResponse(), "111"),
		).toBeNull();
		const incomplete = pagesResponse();
		incomplete.body.pop();
		expect(
			parsePixivMetadata(artworkResponse(), incomplete, artworkId),
		).toBeNull();
		const ugoira = artworkResponse();
		ugoira.body.illustType = 2;
		expect(parsePixivMetadata(ugoira, pagesResponse(), artworkId)).toBeNull();
	});
	it.each([
		`https://i.pximg.net.attacker.test/img-original/${artworkId}_p0.jpg`,
		`https://i.pximg.net/img-original/111_p0.jpg`,
		`https://i.pximg.net/img-master/${artworkId}_p0_master1200.jpg`,
	])("rejects incorrect original URL %s", (url) => {
		const pages = pagesResponse();
		pages.body[0].urls.original = url;
		expect(parsePixivMetadata(artworkResponse(), pages, artworkId)).toBeNull();
	});
	it("matches resized/hash-suffixed pages but ignores avatars and related artwork", () => {
		expect(
			getPixivImagePage(
				`https://i.pximg.net/c/600x1200/img-master/img/date/${artworkId}_p1_master1200.jpg`,
				artworkId,
			),
		).toBe(1);
		expect(getPixivImagePage(originalUrls[1], artworkId)).toBe(1);
		expect(
			getPixivImagePage(
				originalUrls[0].replace("_p0", "-757d4d64b92a41c496c04aa34ae56855_p0"),
				artworkId,
			),
		).toBe(0);
		expect(
			getPixivImagePage(
				"https://i.pximg.net/user-profile/img/avatar.jpg",
				artworkId,
			),
		).toBeNull();
		expect(
			getPixivImagePage("https://i.pximg.net/img-master/111_p0.jpg", artworkId),
		).toBeNull();
	});
});

function mediaFixture(urls: string[] = originalUrls) {
	const location = { href: artworkUrl };
	const callbacks: Array<() => Promise<DownloadItem | null>> = [];
	const buttons: HTMLDivElement[] = [];
	const images = urls.map((src) => {
		const parent = {
			style: { position: "static" },
			appendChild(button: HTMLDivElement) {
				Object.defineProperty(button, "parentElement", {
					value: parent,
					configurable: true,
				});
			},
		};
		return {
			tagName: "IMG",
			src,
			currentSrc: "",
			dataset: {},
			parentElement: parent,
			isConnected: true,
			getAttribute: vi.fn<(name: string) => string | null>(() => null),
		};
	});
	vi.stubGlobal("window", {
		location,
		getComputedStyle: () => ({ position: "static" }),
	});
	const document = {
		querySelectorAll: () => images,
		querySelector: vi.fn<() => HTMLElement | null>(() => null),
	};
	vi.stubGlobal("document", document);
	const factory = vi.fn((callback: () => Promise<DownloadItem | null>) => {
		callbacks.push(callback);
		const button = {
			parentElement: null,
			remove: vi.fn(),
		} as unknown as HTMLDivElement;
		buttons.push(button);
		return button;
	});
	const metadata = new Map<string, DownloadItem>();
	return { location, images, factory, callbacks, buttons, metadata, document };
}

function mockSuccess() {
	const fetchMock = vi.fn(async (input: string) =>
		Response.json(
			input.endsWith("/pages") ? pagesResponse() : artworkResponse(),
		),
	);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

describe("Pixiv POST controls", () => {
	it("adds controls only for current artwork and deduplicates repeated DOM processing", () => {
		const fixture = mediaFixture([
			...originalUrls,
			"https://i.pximg.net/img-master/111_p0.jpg",
		]);
		const fetchMock = mockSuccess();
		processPixivMedia(fixture.metadata, fixture.factory);
		processPixivMedia(fixture.metadata, fixture.factory);
		expect(fixture.factory).toHaveBeenCalledTimes(2);
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it("shares pending API requests for multiple pages and retains all fetched metadata", async () => {
		const fixture = mediaFixture();
		const fetchMock = mockSuccess();
		processPixivMedia(fixture.metadata, fixture.factory);
		const items = await Promise.all(
			fixture.callbacks.map((callback) => callback()),
		);
		expect(items.map((item) => item?.targetUrl)).toEqual(originalUrls);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock).toHaveBeenCalledWith(`/ajax/illust/${artworkId}`, {
			credentials: "same-origin",
		});
		expect(fetchMock).toHaveBeenCalledWith(`/ajax/illust/${artworkId}/pages`, {
			credentials: "same-origin",
		});
		expect([...fixture.metadata.keys()]).toEqual(originalUrls);
	});
	it("permits retry after API failure", async () => {
		const fixture = mediaFixture();
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("failed", { status: 403 })),
		);
		processPixivMedia(fixture.metadata, fixture.factory);
		expect(await fixture.callbacks[0]()).toBeNull();
		const fetchMock = mockSuccess();
		expect((await fixture.callbacks[0]())?.targetUrl).toBe(originalUrls[0]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
	it("rejects an old button after navigation before or during the request", async () => {
		const fixture = mediaFixture();
		processPixivMedia(fixture.metadata, fixture.factory);
		const fetchMock = mockSuccess();
		fixture.location.href = "https://www.pixiv.net/artworks/111";
		expect(await fixture.callbacks[0]()).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
		fixture.location.href = artworkUrl;
		const pending = fixture.callbacks[0]();
		fixture.location.href = "https://www.pixiv.net/artworks/111";
		expect(await pending).toBeNull();
		expect(fixture.metadata.size).toBe(0);
	});
	it("replaces controls on a reused image node and rejects stale page callbacks", async () => {
		const fixture = mediaFixture([originalUrls[0]]);
		fixture.images[0].currentSrc = originalUrls[0];
		mockSuccess();
		processPixivMedia(fixture.metadata, fixture.factory);
		fixture.images[0].src = originalUrls[1];
		processPixivMedia(fixture.metadata, fixture.factory);
		expect(fixture.buttons[0].remove).toHaveBeenCalled();
		expect(await fixture.callbacks[0]()).toBeNull();
		expect((await fixture.callbacks[1]())?.targetUrl).toBe(originalUrls[1]);
	});
});

describe("Pixiv ugoira metadata", () => {
	it("preserves the original frame archive and variable frame delays through the extension schema", () => {
		const items = parsePixivMetadata(
			ugoiraArtworkResponse(),
			ugoiraResponse(),
			artworkId,
		);
		expect(items).toHaveLength(1);
		const item = downloadItemSchema.parse(items?.[0]);
		expect(item.targetUrl).toBe(ugoiraUrl);
		expect(item.sourceUrls).toEqual([ugoiraUrl, artworkUrl]);
		expect(item.ugoira).toEqual({ frames: ugoiraResponse().body.frames });
		expect(item.authors?.[0]).toMatchObject({
			platform: "pixiv",
			remoteId: "98765",
		});
		expect(item.tags).toContainEqual({
			name: "風景",
			type: "positive",
			source: "pixiv",
		});
		expect(item.cookies).toBeUndefined();
	});
	it.each([
		ugoiraUrl.replace("i.pximg.net/", "i.pximg.net.attacker.test/"),
		ugoiraUrl.replace("https:", "http:"),
		ugoiraUrl.replace("img-zip-ugoira", "img-original"),
		ugoiraUrl.replace(artworkId, "111"),
		originalUrls[0],
	])("rejects incorrect frame archive URL %s", (url) => {
		const response = ugoiraResponse();
		response.body.originalSrc = url;
		expect(
			parsePixivMetadata(ugoiraArtworkResponse(), response, artworkId),
		).toBeNull();
	});
	it.each([
		{ frames: [] },
		{ frames: [{ file: "../../000000.jpg", delay: 100 }] },
		{ frames: [{ file: "000000.jpg", delay: 0 }] },
		{ frames: [{ file: "000000.jpg", delay: 60001 }] },
		{
			frames: [
				{ file: "000000.jpg", delay: 100 },
				{ file: "000000.jpg", delay: 200 },
			],
		},
	])("rejects malformed or unsafe frame timing %j", ({ frames }) => {
		const response = ugoiraResponse();
		response.body.frames = frames;
		expect(
			parsePixivMetadata(ugoiraArtworkResponse(), response, artworkId),
		).toBeNull();
	});
	it("does not substitute a poster or preview archive when ugoira metadata fails", () => {
		expect(
			parsePixivMetadata(
				ugoiraArtworkResponse(),
				{ error: true, body: null },
				artworkId,
			),
		).toBeNull();
		const { originalSrc: _originalSrc, ...body } = ugoiraResponse().body;
		expect(
			parsePixivMetadata(
				ugoiraArtworkResponse(),
				{ error: false, body },
				artworkId,
			),
		).toBeNull();
		expect(
			parsePixivMetadata(ugoiraArtworkResponse(), pagesResponse(), artworkId),
		).toBeNull();
	});
});

function mockUgoiraSuccess() {
	const fetchMock = vi.fn(async (input: string) =>
		Response.json(
			input.endsWith("/ugoira_meta")
				? ugoiraResponse()
				: ugoiraArtworkResponse(),
		),
	);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

describe("Pixiv ugoira POST controls", () => {
	it.each(["ugoira0.png", "master1200.jpg"])(
		"recognizes the current artwork poster %s",
		async (suffix) => {
			const fixture = mediaFixture([
				`https://i.pximg.net/img-master/img/date/${artworkId}_${suffix}`,
			]);
			const fetchMock = mockUgoiraSuccess();
			processPixivMedia(fixture.metadata, fixture.factory);
			expect(fetchMock).not.toHaveBeenCalled();
			const item = await fixture.callbacks[0]();
			expect(item?.targetUrl).toBe(ugoiraUrl);
			expect(item?.ugoira?.frames).toEqual(ugoiraResponse().body.frames);
			expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
				`/ajax/illust/${artworkId}`,
				`/ajax/illust/${artworkId}/ugoira_meta`,
			]);
		},
	);
	it.each(["CANVAS", "VIDEO"])(
		"adds POST to the primary %s player without preload metadata",
		async (tagName) => {
			const fixture = mediaFixture(["", ""]);
			fixture.images[0].tagName = tagName;
			fixture.images[1].tagName = "CANVAS";
			fixture.document.querySelector.mockReturnValue(
				fixture.images[0] as unknown as HTMLElement,
			);
			const fetchMock = mockUgoiraSuccess();
			processPixivMedia(fixture.metadata, fixture.factory);
			processPixivMedia(fixture.metadata, fixture.factory);
			expect(fixture.factory).toHaveBeenCalledTimes(1);
			expect(fetchMock).not.toHaveBeenCalled();
			expect((await fixture.callbacks[0]())?.targetUrl).toBe(ugoiraUrl);
		},
	);
	it("ignores same-artwork sidebar thumbnails and unassociated canvas elements", () => {
		const fixture = mediaFixture([
			`https://i.pximg.net/img-master/img/date/${artworkId}_square1200.jpg`,
			"",
		]);
		fixture.images[1].tagName = "CANVAS";
		processPixivMedia(fixture.metadata, fixture.factory);
		expect(fixture.factory).not.toHaveBeenCalled();
	});
	it("does not silently import a still image from an unrelated player candidate", async () => {
		const fixture = mediaFixture([""]);
		fixture.images[0].tagName = "CANVAS";
		fixture.document.querySelector.mockReturnValue(
			fixture.images[0] as unknown as HTMLElement,
		);
		mockSuccess();
		processPixivMedia(fixture.metadata, fixture.factory);
		expect(await fixture.callbacks[0]()).toBeNull();
		expect(fixture.metadata.size).toBe(0);
	});
	it("rejects a player callback if SPA navigation occurs during metadata fetch", async () => {
		const fixture = mediaFixture([""]);
		fixture.images[0].tagName = "CANVAS";
		fixture.document.querySelector.mockReturnValue(
			fixture.images[0] as unknown as HTMLElement,
		);
		mockUgoiraSuccess();
		processPixivMedia(fixture.metadata, fixture.factory);
		const pending = fixture.callbacks[0]();
		fixture.location.href = "https://www.pixiv.net/artworks/111";
		expect(await pending).toBeNull();
		expect(fixture.metadata.size).toBe(0);
	});
	it("retries the ugoira endpoint after an error and never sends its poster", async () => {
		const fixture = mediaFixture([
			`https://i.pximg.net/img-master/img/date/${artworkId}_ugoira0.png`,
		]);
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string) =>
				url.endsWith("/ugoira_meta")
					? new Response("failed", { status: 403 })
					: Response.json(ugoiraArtworkResponse()),
			),
		);
		processPixivMedia(fixture.metadata, fixture.factory);
		expect(await fixture.callbacks[0]()).toBeNull();
		expect(fixture.metadata.size).toBe(0);
		mockUgoiraSuccess();
		expect((await fixture.callbacks[0]())?.targetUrl).toBe(ugoiraUrl);
	});
});
