import { ORPCError } from "@orpc/server";
import {
	pixivArtworkSchema,
	pixivImageUrlSchema,
	type PixivCard,
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
	async function request(path: string, params: URLSearchParams, ajax = true) {
		const url = new URL(path, "https://www.pixiv.net");
		url.search = params.toString();
		const headers: Record<string, string> = {
			Referer: "https://www.pixiv.net/",
			Accept: "application/json",
		};
		if (sessionId)
			headers.Cookie = "PHPSESSID=" + encodeURIComponent(sessionId);
		let response: Response;
		try {
			response = await fetchRemote(url, {
				headers,
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
	return {
		async search(word: string, page: number) {
			if (!word) {
				const data = ranking.parse(
					await request(
						"/ranking.php",
						new URLSearchParams({
							format: "json",
							mode: "daily",
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
export const pixivService = createPixivService(
	fetch,
	process.env.PIXIV_PHPSESSID,
);
