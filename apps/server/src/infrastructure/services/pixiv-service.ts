import { ORPCError } from "@orpc/server";
import {
	pixivArtworkSchema,
	pixivImageUrlSchema,
	type PixivCard,
	type PixivBookmarksRequest,
	type PixivBookmarkFilter,
	type PixivBookmarkChange,
	type PixivBookmarkState,
	type PixivFeed,
	type PixivRelatedPage,
} from "@solid-imager/core/external-viewer";
import { ugoiraMetadataSchema } from "@solid-imager/core/media";
import { z } from "zod";

const id = z.coerce.number().int().positive();
const count = z.coerce.number().int().positive();
const searchRows = z.object({
	illustManga: z.object({
		lastPage: z.number().int().nonnegative(),
		data: z.array(z.unknown()),
	}),
});
const searchCard = z.object({
	id,
	title: z.string(),
	userName: z.string(),
	url: z.string().nullish(),
	pageCount: count,
});
const bookmarkedWorks = z.object({
	works: z.array(z.unknown()),
	total: z.coerce.number().int().nonnegative(),
});
const artworkBookmark = z.object({
	illustId: id,
	isBookmarkable: z.boolean(),
	bookmarkData: z
		.object({
			id: z.union([
				z.string().regex(/^[1-9]\d*$/),
				z.number().int().positive().transform(String),
			]),
			private: z.boolean(),
		})
		.nullable(),
});
const changingBookmarks = new Set<string>();
const bookmarkTagList = z.array(
	z.object({
		tag: z.string().min(1).max(200),
		cnt: z.coerce.number().int().nonnegative(),
	}),
);
const bookmarkTags = z.object({
	public: bookmarkTagList.default([]),
	private: bookmarkTagList.default([]),
});
const bookmarkTagResponse = z
	.union([z.object({ tags: bookmarkTags }), bookmarkTags])
	.transform((body) => ("tags" in body ? body.tags : body));
const ranking = z.object({
	contents: z.array(
		z.object({
			illust_id: id,
			title: z.string(),
			user_name: z.string(),
			url: z.string(),
			illust_page_count: count,
			is_masked: z.boolean().optional(),
		}),
	),
	next: z.union([z.number(), z.literal(false), z.null()]),
});
const artwork = z.object({
	id,
	title: z.string(),
	userId: z.string(),
	userName: z.string(),
	createDate: z.iso.datetime({ offset: true }),
	illustType: z.number(),
	pageCount: count,
	width: count,
	height: count,
	urls: z.object({
		regular: pixivImageUrlSchema,
		small: pixivImageUrlSchema.nullish(),
	}),
	tags: z.object({ tags: z.array(z.object({ tag: z.string() })) }),
});
const pageList = z
	.array(
		z.object({
			urls: z.object({
				regular: pixivImageUrlSchema,
				original: pixivImageUrlSchema.nullish(),
			}),
			width: count,
			height: count,
		}),
	)
	.min(1);
const envelope = z.object({ error: z.boolean(), body: z.unknown() });
const unavailable = (message: string) =>
	new ORPCError("BAD_GATEWAY", { message });
function thumb(value: string | null | undefined) {
	const parsed = pixivImageUrlSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

export function createPixivService(
	fetchRemote: (url: URL, init: RequestInit) => Promise<Response> = fetch,
	sessionId?: string,
) {
	async function request(
		path: string,
		params: URLSearchParams,
		ajax = true,
		write?: { token: string; body: string | URLSearchParams },
	) {
		const url = new URL(path, "https://www.pixiv.net");
		url.search = params.toString();
		const headers: Record<string, string> = {
			Referer: "https://www.pixiv.net/",
			Accept: "application/json",
		};
		if (sessionId) headers.Cookie = "PHPSESSID=" + sessionId;
		if (write) {
			headers["X-CSRF-TOKEN"] = write.token;
			headers["X-Requested-With"] = "XMLHttpRequest";
			headers.Origin = url.origin;
			if (typeof write.body === "string")
				headers["Content-Type"] = "application/json";
		}
		let response: Response;
		try {
			response = await fetchRemote(url, {
				headers,
				method: write ? "POST" : "GET",
				body: write?.body,
				redirect: "error",
				signal: AbortSignal.timeout(15_000),
			});
		} catch {
			throw unavailable("pixiv に接続できませんでした。");
		}
		if (!response.ok)
			throw new ORPCError(
				response.status === 404
					? "NOT_FOUND"
					: response.status === 429
						? "TOO_MANY_REQUESTS"
						: "BAD_GATEWAY",
				{
					message:
						"pixiv が応答しました (HTTP " +
						response.status +
						")。公開範囲やアクセス制限を確認してください。",
				},
			);
		const data: unknown = await response.json();
		if (!ajax) return data;
		const result = envelope.parse(data);
		if (result.error)
			throw unavailable(
				"pixiv から作品を取得できませんでした。作品の公開範囲やログイン状態を確認してください。",
			);
		return result.body;
	}
	const bookmarkParams = () => new URLSearchParams({ lang: "ja" });
	async function readBookmark(postId: number) {
		const data = artworkBookmark.parse(
			await request(
				"/ajax/illust/" + postId + "/bookmarkData",
				bookmarkParams(),
			),
		);
		if (data.illustId !== postId)
			throw unavailable("pixiv の作品 ID が一致しません。");
		return data;
	}
	function bookmarkState(
		data: z.infer<typeof artworkBookmark>,
	): PixivBookmarkState {
		return {
			visibility: data.bookmarkData
				? data.bookmarkData.private
					? "private"
					: "public"
				: null,
			canAdd: data.isBookmarkable,
		};
	}
	return {
		async bookmarkState(postId: number) {
			return bookmarkState(await readBookmark(postId));
		},
		async setBookmark(
			userId: string,
			input: PixivBookmarkChange,
			getToken: () => Promise<string>,
		): Promise<PixivBookmarkState> {
			const { id: postId, visibility } = input;
			const key = userId + ":" + postId;
			if (changingBookmarks.has(key))
				throw new ORPCError("CONFLICT", {
					message: "この作品のブックマークを更新中です。",
				});
			changingBookmarks.add(key);
			try {
				const current = await readBookmark(postId);
				if (visibility === null && !current.bookmarkData)
					return bookmarkState(current);
				if (visibility !== null) {
					if (current.bookmarkData) return bookmarkState(current);
					if (!current.isBookmarkable)
						throw new ORPCError("FORBIDDEN", {
							message: "この作品はブックマークできません。",
						});
				}
				const token = await getToken();
				if (current.bookmarkData) {
					await request(
						"/ajax/illusts/bookmarks/delete",
						bookmarkParams(),
						true,
						{
							token,
							body: new URLSearchParams({
								bookmark_id: current.bookmarkData.id,
							}),
						},
					);
				} else {
					await request("/ajax/illusts/bookmarks/add", bookmarkParams(), true, {
						token,
						body: JSON.stringify({
							illust_id: postId,
							restrict: visibility === "private" ? 1 : 0,
							comment: "",
							tags: [],
						}),
					});
				}
				return { visibility, canAdd: current.isBookmarkable };
			} finally {
				changingBookmarks.delete(key);
			}
		},
		async bookmarks(userId: string, input: PixivBookmarksRequest) {
			const pageSize = 48;
			const offset = (input.page - 1) * pageSize;
			const data = bookmarkedWorks.parse(
				await request(
					"/ajax/user/" + userId + "/illusts/bookmarks",
					new URLSearchParams({
						tag: input.tag,
						offset: String(offset),
						limit: String(pageSize),
						rest: input.visibility === "private" ? "hide" : "show",
						lang: "ja",
					}),
				),
			);
			const posts: PixivCard[] = [];
			for (const raw of data.works) {
				if (
					!raw ||
					typeof raw !== "object" ||
					!("id" in raw) ||
					("isMasked" in raw && raw.isMasked)
				)
					continue;
				const row = searchCard.parse(raw);
				posts.push({
					id: row.id,
					title: row.title,
					author: row.userName,
					thumbnail: thumb(row.url),
					pageCount: row.pageCount,
				});
			}
			return {
				provider: "pixiv" as const,
				word: "",
				mappings: [],
				posts,
				hasNextPage:
					data.works.length > 0 &&
					offset + pageSize < data.total &&
					input.page < 1000,
			};
		},
		async bookmarkTags(
			userId: string,
			visibility: PixivBookmarkFilter["visibility"],
		) {
			const data = bookmarkTagResponse.parse(
				await request(
					"/ajax/user/" + userId + "/illusts/bookmark/tags",
					new URLSearchParams({ lang: "ja" }),
				),
			);
			return [
				...new Set(
					data[visibility].filter(({ cnt }) => cnt > 0).map(({ tag }) => tag),
				),
			];
		},
		async related(postId: number, ids?: number[]): Promise<PixivRelatedPage> {
			const params = new URLSearchParams({ limit: "18", lang: "ja" });
			for (const id of ids ?? []) params.append("illust_ids", String(id));
			const data = z
				.object({
					illusts: z.array(z.unknown()),
					nextIds: z.array(id).default([]),
				})
				.parse(
					await request(
						ids
							? "/ajax/illust/recommend/illusts"
							: "/ajax/illust/" + postId + "/recommend/init",
						params,
					),
				);
			const posts = new Map<number, PixivCard>();
			for (const raw of data.illusts) {
				if (
					!raw ||
					typeof raw !== "object" ||
					("isAdContainer" in raw && raw.isAdContainer) ||
					("isMasked" in raw && raw.isMasked)
				)
					continue;
				const row = searchCard.parse(raw);
				if (row.id === postId || (ids && !ids.includes(row.id))) continue;
				posts.set(row.id, {
					id: row.id,
					title: row.title,
					author: row.userName,
					thumbnail: thumb(row.url),
					pageCount: row.pageCount,
				});
			}
			return {
				posts: [...posts.values()].slice(0, 18),
				nextIds: ids
					? []
					: [...new Set(data.nextIds)].filter(
							(id) => id !== postId && !posts.has(id),
						),
			};
		},
		async userWorks(userId: string, page: number) {
			const directory = z
				.object({
					illusts: z
						.union([
							z.record(z.string().regex(/^\d+$/), z.null()),
							z.array(z.never()),
						])
						.nullish(),
					manga: z
						.union([
							z.record(z.string().regex(/^\d+$/), z.null()),
							z.array(z.never()),
						])
						.nullish(),
				})
				.parse(
					await request(
						"/ajax/user/" + userId + "/profile/all",
						new URLSearchParams(),
					),
				);
			const ids = [
				...new Set([
					...Object.keys(directory.illusts ?? {}),
					...Object.keys(directory.manga ?? {}),
				]),
			].sort((a, b) => Number(b) - Number(a));
			const pageSize = 48;
			const selected = ids.slice((page - 1) * pageSize, page * pageSize);
			if (!selected.length) return { posts: [], hasNextPage: false };
			const params = new URLSearchParams({
				work_category: "illustManga",
				is_first_page: page === 1 ? "1" : "0",
				lang: "ja",
			});
			for (const id of selected) params.append("ids[]", id);
			const data = z
				.object({ works: z.record(z.string(), z.unknown()) })
				.parse(
					await request("/ajax/user/" + userId + "/profile/illusts", params),
				);
			const posts: PixivCard[] = [];
			for (const id of selected) {
				const raw = data.works[id];
				if (
					!raw ||
					typeof raw !== "object" ||
					("isMasked" in raw && raw.isMasked === true)
				)
					continue;
				const row = searchCard.extend({ userId: z.string() }).parse(raw);
				if (row.userId !== userId || String(row.id) !== id)
					throw unavailable("pixiv の作者と作品が一致しません。");
				posts.push({
					id: row.id,
					title: row.title,
					author: row.userName,
					thumbnail: thumb(row.url),
					pageCount: row.pageCount,
				});
			}
			return {
				posts,
				hasNextPage: page * pageSize < ids.length && page < 1000,
			};
		},
		async followLatest(page: number) {
			if (!sessionId)
				throw new ORPCError("UNAUTHORIZED", {
					message: "フォロー新着を見るには pixiv にログインしてください。",
				});
			const data = z
				.object({
					page: z.object({ isLastPage: z.boolean() }),
					thumbnails: z.object({ illust: z.array(z.unknown()) }),
				})
				.parse(
					await request(
						"/ajax/follow_latest/illust",
						new URLSearchParams({ p: String(page), mode: "all", lang: "ja" }),
					),
				);
			const posts: PixivCard[] = [];
			for (const raw of data.thumbnails.illust) {
				if (
					!raw ||
					typeof raw !== "object" ||
					!("id" in raw) ||
					("isMasked" in raw && raw.isMasked)
				)
					continue;
				const row = searchCard.parse(raw);
				posts.push({
					id: row.id,
					title: row.title,
					author: row.userName,
					thumbnail: thumb(row.url),
					pageCount: row.pageCount,
				});
			}
			return {
				posts,
				hasNextPage:
					!data.page.isLastPage &&
					data.thumbnails.illust.length > 0 &&
					page < 1000,
			};
		},
		async search(word: string, page: number, feed: PixivFeed = "daily") {
			if (!word && feed === "follow") return this.followLatest(page);
			if (!word) {
				const data = ranking.parse(
					await request(
						"/ranking.php",
						new URLSearchParams({
							format: "json",
							mode: feed,
							p: String(page),
						}),
						false,
					),
				);
				return {
					posts: data.contents
						.filter((row) => !row.is_masked)
						.map((row): PixivCard => ({
							id: row.illust_id,
							title: row.title,
							author: row.user_name,
							thumbnail: thumb(row.url),
							pageCount: row.illust_page_count,
						})),
					hasNextPage: !!data.next && page < 1000,
				};
			}
			const params = new URLSearchParams({
				word,
				order: "date_d",
				mode: "all",
				p: String(page),
				s_mode: "s_tag_full",
				type: "all",
				lang: "ja",
			});
			const { illustManga } = searchRows.parse(
				await request(
					"/ajax/search/artworks/" + encodeURIComponent(word),
					params,
				),
			);
			// Advertisements and masked placeholders may lack artwork metadata.

			const posts: PixivCard[] = [];
			for (const raw of illustManga.data) {
				if (!raw || typeof raw !== "object" || !("id" in raw)) continue;
				if ("isMasked" in raw && raw.isMasked === true) continue;
				const row = searchCard.parse(raw);
				posts.push({
					id: row.id,
					title: row.title,
					author: row.userName,
					thumbnail: thumb(row.url),
					pageCount: row.pageCount,
				});
			}
			return {
				posts,
				hasNextPage:
					illustManga.data.length > 0 &&
					page < 1000 &&
					page < illustManga.lastPage,
			};
		},
		async getPost(postId: number) {
			const path = "/ajax/illust/" + postId;
			const detail = artwork.parse(
				await request(path, new URLSearchParams({ lang: "ja" })),
			);
			if (detail.id !== postId)
				throw unavailable("pixiv の作品 ID が一致しません。");
			const base = {
				isAnimation: detail.illustType === 2,
				id: postId,
				title: detail.title,
				userId: detail.userId,
				author: detail.userName,
				createdAt: detail.createDate,
				tags: detail.tags.tags.map((row) => row.tag),
				thumbnail: detail.urls.small ?? detail.urls.regular,
				pageCount: detail.pageCount,
			};
			if (detail.illustType === 2) {
				const poster = {
					...base,
					pages: [
						{
							preview: detail.urls.regular,
							original: null,
							width: detail.width,
							height: detail.height,
						},
					],
				};
				const data = await request(
					path + "/ugoira_meta",
					new URLSearchParams(),
				).catch((error) => {
					if (
						error instanceof ORPCError &&
						(error.code === "BAD_GATEWAY" || error.code === "NOT_FOUND")
					)
						return null;
					throw error;
				});
				if (!data) return pixivArtworkSchema.parse(poster);
				const meta = ugoiraMetadataSchema
					.and(z.object({ originalSrc: z.url() }))
					.parse(data);
				const archive = new URL(meta.originalSrc);
				if (
					archive.origin !== "https://i.pximg.net" ||
					archive.username ||
					archive.password ||
					!archive.pathname.startsWith("/img-zip-ugoira/") ||
					archive.pathname.match(
						/\/(\d+)(?:-[a-z0-9]+)?_ugoira\d+x\d+\.zip$/i,
					)?.[1] !== String(postId)
				)
					throw unavailable("うごイラの原本 URL が無効です。");
				return pixivArtworkSchema.parse({
					...base,
					pages: [
						{
							preview: detail.urls.regular,
							original: null,
							width: detail.width,
							height: detail.height,
						},
					],
					animation: { zip: archive.href, metadata: { frames: meta.frames } },
				});
			}
			const pages = pageList.parse(
				await request(path + "/pages", new URLSearchParams()),
			);
			if (pages.length !== detail.pageCount)
				throw unavailable("pixiv のページ数が一致しません。");
			return pixivArtworkSchema.parse({
				...base,
				pages: pages.map((row, index) => {
					const original = row.urls.original;
					if (original) {
						const url = new URL(original);
						const match = url.pathname.match(
							/\/(\d+)(?:-[a-z0-9]+)?_p(\d+)\.[a-z0-9]+$/i,
						);
						if (
							!url.pathname.startsWith("/img-original/") ||
							match?.[1] !== String(postId) ||
							Number(match[2]) !== index
						)
							throw unavailable("pixiv の原本が作品ページと一致しません。");
					}
					return {
						preview: row.urls.regular,
						original: original ?? null,
						width: row.width,
						height: row.height,
					};
				}),
			});
		},
	};
}
