import {
	danbooruMediaUrlSchema,
	type DanbooruPost,
	type DanbooruSearch,
} from "@solid-imager/core/danbooru";
import { z } from "zod";

const remotePostSchema = z.object({
	id: z.number().int().positive(),
	file_url: z.string().nullish(),
	large_file_url: z.string().nullish(),
	preview_file_url: z.string().nullish(),
	file_ext: z.string().default(""),
	image_width: z.number().int().nonnegative().default(0),
	image_height: z.number().int().nonnegative().default(0),
	file_size: z.number().int().nonnegative().default(0),
	rating: z.string(),
	score: z.number().int().default(0),
	created_at: z.iso.datetime({ offset: true }),
	source: z.string().default(""),
	tag_string_general: z.string().default(""),
	tag_string_artist: z.string().default(""),
	tag_string_copyright: z.string().default(""),
	tag_string_character: z.string().default(""),
	tag_string_meta: z.string().default(""),
});
const remoteTagsSchema = z.array(
	z.object({
		name: z.string(),
		category: z.number().int(),
		post_count: z.number().int().nonnegative(),
	}),
);

const tags = (value: string) => value.split(/\s+/).filter(Boolean);
function mediaUrl(value: string | null | undefined): string | null {
	const parsed = danbooruMediaUrlSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

function mapPost(post: z.infer<typeof remotePostSchema>): DanbooruPost {
	return {
		id: post.id,
		fileUrl: mediaUrl(post.file_url),
		sampleUrl: mediaUrl(post.large_file_url),
		previewUrl: mediaUrl(post.preview_file_url),
		fileExt: post.file_ext,
		width: post.image_width,
		height: post.image_height,
		fileSize: post.file_size,
		rating: post.rating,
		score: post.score,
		createdAt: post.created_at,
		source: post.source,
		tags: {
			general: tags(post.tag_string_general),
			artist: tags(post.tag_string_artist),
			copyright: tags(post.tag_string_copyright),
			character: tags(post.tag_string_character),
			meta: tags(post.tag_string_meta),
		},
	};
}

export class DanbooruRequestError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "DanbooruRequestError";
	}
}

/** Fixed upstream origin, bounded cache, and a shared request budget for all clients. */
export function createDanbooruService(
	options: {
		fetch?: typeof fetch;
		wait?: (ms: number) => Promise<void>;
		login?: string;
		apiKey?: string;
	} = {},
) {
	const fetchRemote = options.fetch ?? fetch;
	const wait =
		options.wait ??
		((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
	let queue = Promise.resolve();
	let nextRequestAt = 0;
	const cache = new Map<string, { expires: number; value: unknown }>();
	const pending = new Map<string, Promise<unknown>>();
	async function request(
		path: string,
		params: URLSearchParams,
		ttl = 30_000,
	): Promise<unknown> {
		const url = new URL(path, "https://danbooru.donmai.us");
		url.search = params.toString();
		const key = url.href;
		const cached = cache.get(key);
		if (cached && cached.expires > Date.now()) return cached.value;
		const active = pending.get(key);
		if (active) return active;
		const response = (async () => {
			const turn = queue.then(async () => {
				await wait(Math.max(0, nextRequestAt - Date.now()));
				nextRequestAt = Date.now() + 250;
			});
			queue = turn.catch(() => undefined);
			await turn;
			const headers: Record<string, string> = {
				Accept: "application/json",
				"User-Agent": "SolidImager/1.0 (Danbooru viewer)",
			};
			if (options.login && options.apiKey) {
				headers.Authorization = `Basic ${Buffer.from(`${options.login}:${options.apiKey}`).toString("base64")}`;
			}
			let result: Response;
			try {
				result = await fetchRemote(url, {
					headers,
					redirect: "error",
					signal: AbortSignal.timeout(15_000),
				});
			} catch {
				throw new DanbooruRequestError(
					502,
					"Danbooru に接続できませんでした。時間をおいて再試行してください。",
				);
			}
			if (!result.ok) {
				const message =
					result.status === 429
						? "Danbooru のアクセス制限に達しました。時間をおいて再試行してください。"
						: result.status === 503
							? "Danbooru がメンテナンス中、または一時的に利用できません。時間をおいて再試行してください。"
							: result.status === 422
								? "Danbooru が検索条件を受け付けませんでした。検索タグ数などを確認してください。"
								: result.status === 404
									? "Danbooru の投稿が見つかりません。"
									: "Danbooru から取得できませんでした。公開範囲やアクセス制限を確認してください。";
				throw new DanbooruRequestError(result.status, message);
			}
			let value: unknown;
			try {
				value = await result.json();
			} catch {
				throw new DanbooruRequestError(
					502,
					"Danbooru の応答を読み取れませんでした。",
				);
			}
			if (cache.size >= 128) {
				const oldest = cache.keys().next().value;
				if (oldest) cache.delete(oldest);
			}
			cache.set(key, { expires: Date.now() + ttl, value });
			return value;
		})();
		pending.set(key, response);
		try {
			return await response;
		} finally {
			pending.delete(key);
		}
	}

	return {
		async search(input: DanbooruSearch) {
			const data = await request(
				"/posts.json",
				new URLSearchParams({
					tags: input.tags,
					page: String(input.page),
					limit: String(input.limit),
				}),
			);
			const posts = z.array(remotePostSchema).parse(data).map(mapPost);
			return {
				posts,
				hasNextPage: posts.length === input.limit && input.page < 1000,
			};
		},
		async getPost(id: number) {
			return mapPost(
				remotePostSchema.parse(
					await request(`/posts/${id}.json`, new URLSearchParams()),
				),
			);
		},
		async wikiNames(tag: string): Promise<string[]> {
			// Query by exact title, so tag punctuation cannot alter the upstream path.
			const rows = z
				.array(
					z.object({ title: z.string(), other_names: z.array(z.string()) }),
				)
				.parse(
					await request(
						"/wiki_pages.json",
						new URLSearchParams({
							"search[title]": tag,
							"search[hide_deleted]": "true",
							only: "title,other_names",
							limit: "1",
						}),
						3_600_000,
					),
				);
			return rows.find((row) => row.title === tag)?.other_names ?? [];
		},
		async suggestWikiTitles(query: string) {
			const rows = z
				.array(
					z.object({ title: z.string(), category_name: z.string().nullish() }),
				)
				.parse(
					await request(
						"/wiki_pages.json",
						new URLSearchParams({
							"search[other_names_match]": query + "*",
							"search[hide_deleted]": "true",
							"search[order]": "post_count",
							only: "title,category_name",
							limit: "12",
						}),
						300_000,
					),
				);
			const categories: Record<string, number> = {
				general: 0,
				artist: 1,
				copyright: 3,
				character: 4,
				meta: 5,
			};
			return rows.map((row) => ({
				name: row.title,
				category: categories[row.category_name ?? ""] ?? null,
				postCount: null,
			}));
		},
		async suggestTags(query: string) {
			const data = await request(
				"/tags.json",
				new URLSearchParams({
					"search[name_or_alias_matches]": `${query}*`,
					"search[order]": "count",
					"search[hide_empty]": "true",
					"search[is_deprecated]": "false",
					limit: "12",
				}),
				300_000,
			);
			return remoteTagsSchema.parse(data).map((tag) => ({
				name: tag.name,
				category: tag.category,
				postCount: tag.post_count,
			}));
		},
	};
}

export const danbooruService = createDanbooruService({
	login: process.env.DANBOORU_LOGIN,
	apiKey: process.env.DANBOORU_API_KEY,
});
