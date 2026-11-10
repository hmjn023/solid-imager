import { expect, it, vi } from "vitest";
import {
	resolvePixivQuery,
	matchSnapshotTags,
} from "~/infrastructure/services/viewer-tags";
import { createPixivService } from "~/infrastructure/services/pixiv-service";
import { servePixivImage } from "~/infrastructure/services/pixiv-image";

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
	const request = (src: string) =>
		new Request(
			"https://example.org/api/pixiv-image?" +
				new URLSearchParams({ url: src }),
		);
	for (const url of [
		"http://127.0.0.1/admin",
		good.replace("i.pximg.net", "i.pximg.net.evil.com"),
		good.replace("https://", "https://user@"),
	]) {
		expect((await servePixivImage(request(url), fetchRemote)).status).toBe(400);
	}
	expect(fetchRemote).not.toHaveBeenCalled();
	expect((await servePixivImage(request(good), fetchRemote)).status).toBe(200);
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
