import { expect, it, vi } from "vitest";
import {
	resolvePixivQuery,
	matchSnapshotTags,
} from "~/infrastructure/services/viewer-tags";
import { createPixivService } from "~/infrastructure/services/pixiv-service";
import { servePixivImage } from "~/infrastructure/services/pixiv-image";
import { createRouterClient } from "@orpc/server";
import { viewerRouter } from "~/infrastructure/api/routers/viewer-router";
import { pixivSessions } from "~/infrastructure/services/pixiv-sessions";

it("converts the shared include, exclusion and optional tags while preserving ambiguity", async () => {
	const lookup = vi.fn(async (tag: string) => ({
		names:
			(
				{
					hatsune_miku: ["初音ミク", "ミク"],
					cat: ["猫"],
					dog: ["犬"],
					monochrome: ["モノクロ"],
				} as Record<string, string[]>
			)[tag] ?? [],
		source: "wiki" as const,
	}));
	const q = await resolvePixivQuery(
		"hatsune_miku -monochrome ~cat ~dog",
		{},
		lookup,
	);
	expect(q.word).toBe("初音ミク -モノクロ (猫 OR 犬)");
	expect(q.mappings[0].names).toContain("ミク");
	expect(
		(await resolvePixivQuery("hatsune_miku", { hatsune_miku: "ミク" }, lookup))
			.word,
	).toBe("ミク");
	expect((await resolvePixivQuery("unmapped", {}, lookup)).word).toBe(
		"unmapped",
	);
	await expect(resolvePixivQuery("rating:g", {}, lookup)).rejects.toThrow(
		"この条件",
	);
});
it("searches pixiv exact tags, respects upstream page caps and keeps auth on the metadata host", async () => {
	let requested: URL | undefined, headers: Headers | undefined;
	const service = createPixivService(async (input, init) => {
		requested = input;
		headers = new Headers(init?.headers);
		return Response.json({
			error: false,
			body: {
				illustManga: {
					data: [
						{
							id: "123",
							title: "test",
							userName: "a",
							pageCount: 3,
							url: null,
						},
						{ isAdContainer: true },
					],
					lastPage: 10,
					total: 10000,
				},
			},
		});
	}, "fixture");
	const res = await service.search("初音ミク -モノクロ", 10);
	expect(requested?.origin).toBe("https://www.pixiv.net");
	expect(requested?.searchParams.get("word")).toBe("初音ミク -モノクロ");
	expect(requested?.searchParams.get("s_mode")).toBe("s_tag_full");
	expect(headers?.get("Cookie")).toBe("PHPSESSID=fixture");
	expect(res).toMatchObject({
		posts: [{ id: 123, pageCount: 3 }],
		hasNextPage: false,
	});
});
it("only relays images on the trusted CDN and never forwards session credentials", async () => {
	const good =
		"https://i.pximg.net/img-original/img/2026/01/01/00/00/00/123_p0.png";
	const fetchRemote = vi
		.fn<typeof fetch>()
		.mockResolvedValue(
			new Response("image", { headers: { "Content-Type": "image/png" } }),
		);
	for (const url of [
		"http://127.0.0.1/admin",
		good.replace("i.pximg.net", "i.pximg.net.evil.com"),
		good.replace("https://", "https://user@"),
	]) {
		expect((await servePixivImage(url, undefined, fetchRemote)).status).toBe(
			400,
		);
	}
	expect(fetchRemote).not.toHaveBeenCalled();
	expect((await servePixivImage(good, undefined, fetchRemote)).status).toBe(
		200,
	);
	const init = fetchRemote.mock.calls[0][1];
	expect(init?.redirect).toBe("error");
	expect(new Headers(init?.headers).get("Referer")).toBe(
		"https://www.pixiv.net/",
	);
	expect(new Headers(init?.headers).has("cookie")).toBe(false);
});

it("suggests canonical tags for Japanese spellings and ranks exact aliases first", () => {
	const index = {
		miku_append: ["初音ミク・アペンド"],
		hatsune_miku: ["初音ミク"],
		unrelated: ["other"],
	};
	expect(matchSnapshotTags(index, "初音ミク").map((item) => item.name)).toEqual(
		["hatsune_miku", "miku_append"],
	);
});

it("paginates an author's illustrations and manga in newest ID order and keeps credentials on Pixiv", async () => {
	const calls: URL[] = [];
	const service = createPixivService(async (url, init) => {
		calls.push(url);
		expect(new Headers(init.headers).get("Cookie")).toBe("PHPSESSID=fixture");
		if (url.pathname.endsWith("/all"))
			return Response.json({
				error: false,
				body: {
					illusts: Object.fromEntries(
						Array.from({ length: 49 }, (_, i) => [String(i + 1), null]),
					),
					manga: { "50": null, "49": null },
				},
			});
		const ids = url.searchParams.getAll("ids[]");
		return Response.json({
			error: false,
			body: {
				works: Object.fromEntries(
					ids.map((id) => [
						id,
						{
							id,
							title: "work" + id,
							userId: "23",
							userName: "author",
							pageCount: 1,
							url: null,
						},
					]),
				),
			},
		});
	}, "fixture");
	const first = await service.userWorks("23", 1);
	expect(first.posts).toHaveLength(48);
	expect(first.posts[0].id).toBe(50);
	expect(first.hasNextPage).toBe(true);
	const last = await service.userWorks("23", 2);
	expect(last.posts.map((post) => post.id)).toEqual([2, 1]);
	expect(last.hasNextPage).toBe(false);
	expect(calls.every((url) => url.origin === "https://www.pixiv.net")).toBe(
		true,
	);
	expect(calls[1].searchParams.getAll("ids[]")).toHaveLength(48);
});

it("returns related cards without the current work, duplicates, ads or masked works", async () => {
	const row = {
		id: "456",
		title: "related",
		userName: "artist",
		url: null,
		pageCount: 2,
	};
	const service = createPixivService(async (url, init) => {
		expect(url.pathname).toBe("/ajax/illust/123/recommend/init");
		expect(url.searchParams.get("limit")).toBe("18");
		expect(new Headers(init.headers).get("Cookie")).toBe("PHPSESSID=fixture");
		return Response.json({
			error: false,
			body: {
				illusts: [
					row,
					row,
					{ ...row, id: "123" },
					{ isAdContainer: true },
					{ isMasked: true },
				],
				nextIds: ["789"],
			},
		});
	}, "fixture");
	expect(await service.related(123)).toEqual({
		nextIds: [789],
		posts: [
			{
				id: 456,
				title: "related",
				author: "artist",
				thumbnail: null,
				pageCount: 2,
			},
		],
	});
});

it("requests only the next batch and excludes unrelated recommendations", async () => {
	const service = createPixivService(async (url, init) => {
		expect(url.pathname).toBe("/ajax/illust/recommend/illusts");
		expect(url.searchParams.getAll("illust_ids[]")).toEqual(["456", "789"]);
		expect(new Headers(init.headers).get("Cookie")).toBe("PHPSESSID=fixture");
		return Response.json({
			error: false,
			body: {
				illusts: [456, 789, 1000].map((id) => ({
					id,
					title: "work",
					userName: "artist",
					url: null,
					pageCount: 1,
				})),
				nextIds: ["1001"],
			},
		});
	}, "fixture");
	const result = await service.related(123, [456, 789]);
	expect(result.posts.map((post) => post.id)).toEqual([456, 789]);
	expect(result.nextIds).toEqual([]);
});

it("selects ranking periods and retrieves authenticated followed works with pagination", async () => {
	const requests: URL[] = [];
	const service = createPixivService(async (url, init) => {
		requests.push(url);
		if (url.pathname === "/ranking.php")
			return Response.json({ contents: [], next: false });
		expect(new Headers(init.headers).get("Cookie")).toBe("PHPSESSID=fixture");
		return Response.json({
			error: false,
			body: {
				page: { isLastPage: url.searchParams.get("p") === "2" },
				thumbnails: {
					illust: [
						{
							id: "123",
							title: "followed",
							userName: "artist",
							url: null,
							pageCount: 1,
						},
						{ isAdContainer: true },
					],
				},
			},
		});
	}, "fixture");
	await service.search("", 1, "weekly");
	expect(requests[0].searchParams.get("mode")).toBe("weekly");
	const first = await service.search("", 1, "follow");
	expect(first.posts[0].id).toBe(123);
	expect(first.hasNextPage).toBe(true);
	expect(requests[1].pathname).toBe("/ajax/follow_latest/illust");
	expect((await service.search("", 2, "follow")).hasNextPage).toBe(false);
	const guest = createPixivService(async () => {
		throw new Error("Must not fetch");
	});
	await expect(guest.followLatest(1)).rejects.toMatchObject({
		code: "UNAUTHORIZED",
	});
});

it("reads bookmark pages and tags only for the account bound to the session", async () => {
	const issue = vi.spyOn(pixivSessions, "account");
	const fetchRemote = vi.fn(async (url: URL, init: RequestInit) => {
		expect(url.origin).toBe("https://www.pixiv.net");
		expect(new Headers(init.headers).get("Cookie")).toBe("PHPSESSID=fixture");
		expect(init.redirect).toBe("error");
		if (url.pathname.endsWith("/bookmark/tags")) {
			expect(url.pathname).toBe("/ajax/user/23/illusts/bookmark/tags");
			return Response.json({
				error: false,
				body: {
					public: [{ tag: "公開タグ", cnt: "2" }],
					private: [
						{ tag: "夜 景", cnt: 1 },
						{ tag: "空", cnt: 0 },
					],
				},
			});
		}
		expect(url.pathname).toBe("/ajax/user/23/illusts/bookmarks");
		expect(url.searchParams.get("rest")).toBe("hide");
		expect(url.searchParams.get("tag")).toBe("夜 景");
		expect(url.searchParams.get("limit")).toBe("48");
		return Response.json({
			error: false,
			body: {
				total: 49,
				works: [
					{ id: "123", title: "bookmark", userName: "artist", pageCount: 1 },
					{ id: "456", isMasked: true },
				],
			},
		});
	});
	vi.stubGlobal("fetch", fetchRemote);
	try {
		const guest = createRouterClient(viewerRouter, { context: {} });
		await expect(
			guest.pixivBookmarkTags({ visibility: "private" }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		await expect(
			guest.pixivBookmarks({ visibility: "public" }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		expect(fetchRemote).not.toHaveBeenCalled();
		const token = "A".repeat(43);
		issue.mockImplementation((detected) => {
			expect(detected).toBe(token);
			return {
				userId: "23",
				sessionId: "fixture",
				expiresAt: Date.now() + 5000,
			};
		});
		const client = createRouterClient(viewerRouter, {
			context: { pixivAuthorization: "Bearer " + token },
		});
		await expect(
			client.pixivBookmarkTags({ visibility: "public" }),
		).resolves.toEqual(["公開タグ"]);
		await expect(
			client.pixivBookmarkTags({ visibility: "private" }),
		).resolves.toEqual(["夜 景"]);
		const filter = { visibility: "private", tag: "夜 景" } as const;
		const first = await client.pixivBookmarks(filter);
		expect(first.posts).toEqual([
			{
				id: 123,
				title: "bookmark",
				author: "artist",
				thumbnail: null,
				pageCount: 1,
			},
		]);
		expect(first.hasNextPage).toBe(true);
		expect(
			(await client.pixivBookmarks({ ...filter, page: 2 })).hasNextPage,
		).toBe(false);
		expect(
			fetchRemote.mock.calls
				.slice(-2)
				.map(([url]) => url.searchParams.get("offset")),
		).toEqual(["0", "48"]);
	} finally {
		issue.mockRestore();
		vi.unstubAllGlobals();
	}
});
