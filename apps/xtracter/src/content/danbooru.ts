import type { DownloadItem } from "@ext/schema";
import { danbooruMediaUrlSchema } from "@solid-imager/core/danbooru";
import { z } from "zod";

const DANBOORU_ORIGIN = "https://danbooru.donmai.us";
const PROCESSED_IMAGE_CLASS = "xtracter-image-processed";
const POST_ID = /^[1-9]\d*$/;
const POSTS_PER_API_REQUEST = 200;
const TWITTER_REGEX =
	/^https?:\/\/(?:(?:[a-z0-9-]+\.)?(?:twitter\.com|x\.com|vxtwitter\.com|fxtwitter\.com))\/(?:@)?([a-zA-Z0-9_]+)/i;

const danbooruApiPostSchema = z.object({
	id: z.number().int().positive().optional(),
	file_url: z.string().nullish(),
	preview_file_url: z.string().nullish(),
	source: z.string().nullish(),
	tag_string_artist: z.string().optional(),
	tag_string_copyright: z.string().optional(),
	tag_string_character: z.string().optional(),
	tag_string_general: z.string().optional(),
	tag_string_meta: z.string().optional(),
	created_at: z.string().optional(),
});

function getTwitterIdFromUrl(url: string): string | null {
	const username = url.match(TWITTER_REGEX)?.[1];
	const excluded = [
		"intent",
		"search",
		"share",
		"home",
		"i",
		"messages",
		"notifications",
		"settings",
	];
	return username && !excluded.includes(username.toLowerCase())
		? `@${username}`
		: null;
}

function getDetailPostId(): string | null {
	const url = URL.parse(window.location.href);
	return url?.pathname.match(/^\/posts\/([1-9]\d*)\/?$/)?.[1] ?? null;
}

function getCardPostId(card: Element): string | null {
	const id = card.getAttribute("data-id");
	return id && POST_ID.test(id) ? id : null;
}

function getMediaUrl(value: string | null | undefined): string | null {
	const url = value?.trim() ? URL.parse(value, DANBOORU_ORIGIN)?.href : null;
	return url && danbooruMediaUrlSchema.safeParse(url).success ? url : null;
}

function getSourceUrl(source: string | null | undefined): string | null {
	const url = source ? URL.parse(source) : null;
	return url && (url.protocol === "https:" || url.protocol === "http:")
		? url.href
		: null;
}

function buildMetadata({
	postId,
	targetUrl,
	previewUrl,
	sources,
	createdAt,
	description,
	artist,
	copyright,
	character,
	general,
	meta,
}: {
	postId: string;
	targetUrl: string;
	previewUrl?: string | null;
	sources: (string | null | undefined)[];
	createdAt?: string;
	description?: string;
	artist: string[];
	copyright: string[];
	character: string[];
	general: string[];
	meta: string[];
}): DownloadItem {
	const postUrl = `${DANBOORU_ORIGIN}/posts/${postId}`;
	const sourceUrls = new Set([targetUrl]);
	for (const source of sources) {
		const sourceUrl = getSourceUrl(source);
		if (sourceUrl && sourceUrl !== postUrl) sourceUrls.add(sourceUrl);
	}
	const twitterAccountId = [...sourceUrls]
		.map(getTwitterIdFromUrl)
		.find(Boolean);
	sourceUrls.add(postUrl);
	return {
		targetUrl,
		previewUrl: previewUrl && previewUrl !== targetUrl ? previewUrl : undefined,
		sourceUrls: [...sourceUrls],
		// oxlint-disable-next-line ui-text/no-raw-text -- Persist source metadata independently of display language.
		description: description ?? `Danbooru Post #${postId}`,
		createdAt,
		authors: artist.map((name) => ({
			name,
			accountId: artist.length === 1 ? (twitterAccountId ?? name) : name,
			platform:
				artist.length === 1 && twitterAccountId ? "twitter" : "danbooru",
		})),
		tags: [...general, ...meta].map((name) => ({
			name,
			type: "positive",
			source: "danbooru",
		})),
		characters: character.map((name) => ({ name, source: "danbooru" })),
		ips: copyright.map((name) => ({ name, source: "danbooru" })),
		userAgent: navigator.userAgent,
	};
}

function parseTagString(value?: string): string[] {
	return value?.split(/\s+/).filter(Boolean) ?? [];
}

export function parseDanbooruApiMetadata(
	data: unknown,
	postId: string,
): DownloadItem | null {
	const parsed = danbooruApiPostSchema.safeParse(data);
	if (!parsed.success || !POST_ID.test(postId)) return null;
	const post = parsed.data;
	if (post.id !== undefined && String(post.id) !== postId) return null;
	const targetUrl = getMediaUrl(post.file_url);
	if (!targetUrl) return null;
	return buildMetadata({
		postId,
		targetUrl,
		previewUrl: getMediaUrl(post.preview_file_url),
		sources: [post.source],
		createdAt: post.created_at,
		artist: parseTagString(post.tag_string_artist),
		copyright: parseTagString(post.tag_string_copyright),
		character: parseTagString(post.tag_string_character),
		general: parseTagString(post.tag_string_general),
		meta: parseTagString(post.tag_string_meta),
	});
}

async function fetchPostJson(path: string): Promise<unknown> {
	try {
		const response = await fetch(`${DANBOORU_ORIGIN}${path}`, {
			credentials: "same-origin",
		});
		if (
			response.ok &&
			response.headers
				.get("content-type")
				?.toLowerCase()
				.includes("application/json")
		) {
			return await response.json();
		}
	} catch {
		return null;
	}
	return null;
}

async function fetchPostMetadata(postId: string): Promise<DownloadItem | null> {
	return parseDanbooruApiMetadata(
		await fetchPostJson(`/posts/${postId}.json`),
		postId,
	);
}

function extractDetailMetadata(
	container: HTMLElement,
	postId: string,
): DownloadItem | null {
	const targetUrl = getMediaUrl(container.getAttribute("data-file-url"));
	const tagList = document.querySelector("#tag-list");
	if (!targetUrl || !tagList) return null;

	const tagNames = (category: number) =>
		Array.from(
			tagList.querySelectorAll<HTMLElement>(
				`.tag-type-${category}[data-tag-name]`,
			),
			(tag) => tag.dataset.tagName,
		).filter((name): name is string => Boolean(name));
	const sourceUrl = getSourceUrl(container.getAttribute("data-source"));
	const normalizedSource = getSourceUrl(
		container.getAttribute("data-normalized-source"),
	);
	const sources =
		sourceUrl || normalizedSource
			? [sourceUrl, normalizedSource]
			: Array.from(
					document.querySelectorAll<HTMLAnchorElement>("#post-info-source a"),
					(link) => link.href,
				);
	const poster = getMediaUrl(
		document.querySelector<HTMLMetaElement>('meta[property="og:image"]')
			?.content,
	);
	const thumbnailPath = poster ? new URL(poster).pathname : "";

	return buildMetadata({
		postId,
		targetUrl,
		previewUrl: /^\/(?:preview|\d+x\d+)\/.*\.(?:jpe?g|png|webp)$/i.test(
			thumbnailPath,
		)
			? poster
			: null,
		sources,
		createdAt: document.querySelector<HTMLTimeElement>("#post-info-date time")
			?.dateTime,
		description: document.title,
		artist: tagNames(1),
		copyright: tagNames(3),
		character: tagNames(4),
		general: tagNames(0),
		meta: tagNames(5),
	});
}

async function getDetailMetadata(
	postId: string,
	container: HTMLElement | null,
) {
	const metadata =
		container?.getAttribute("data-id") === postId
			? extractDetailMetadata(container, postId)
			: null;
	return metadata ?? fetchPostMetadata(postId);
}

async function fetchListMetadata(postIds: string[]): Promise<DownloadItem[]> {
	const params = new URLSearchParams({
		tags: `id:${postIds.join(",")} status:any`,
		limit: String(postIds.length),
	});
	const data = await fetchPostJson(`/posts.json?${params}`);
	const items = new Map<string, DownloadItem>();
	if (!Array.isArray(data)) return [];
	const requested = new Set(postIds);
	const posts: unknown[] = data;
	for (const post of posts) {
		if (
			typeof post !== "object" ||
			post === null ||
			!("id" in post) ||
			typeof post.id !== "number"
		)
			continue;
		const postId = String(post.id);
		if (!requested.has(postId)) continue;
		const item = parseDanbooruApiMetadata(post, postId);
		if (item) items.set(postId, item);
	}
	return postIds.flatMap((id) => items.get(id) ?? []);
}

export async function getDanbooruPageMetadata(): Promise<DownloadItem[]> {
	const pageUrl = window.location.href;
	const detailId = getDetailPostId();
	if (detailId) {
		const metadata = await getDetailMetadata(
			detailId,
			document.querySelector<HTMLElement>(".image-container"),
		);
		return metadata && getDetailPostId() === detailId ? [metadata] : [];
	}

	const postIds = [
		...new Set(
			Array.from(
				document.querySelectorAll(".post-preview[data-id]"),
				getCardPostId,
			).filter((id): id is string => id !== null),
		),
	];
	const requests: Promise<DownloadItem[]>[] = [];
	for (
		let offset = 0;
		offset < postIds.length;
		offset += POSTS_PER_API_REQUEST
	) {
		requests.push(
			fetchListMetadata(postIds.slice(offset, offset + POSTS_PER_API_REQUEST)),
		);
	}
	const batches = await Promise.all(requests);
	if (window.location.href !== pageUrl) return [];
	return batches.flat();
}

/** Adds controls without requesting metadata until an action is clicked. */
export function processDanbooruMedia(
	createAsyncButtonContainer: (
		fetchMetadata: () => Promise<DownloadItem | null>,
		type: "IMAGE" | "VIDEO",
	) => HTMLDivElement,
): void {
	const postId = getDetailPostId();
	const imageContainer = document.querySelector<HTMLElement>(
		`.image-container:not(.${PROCESSED_IMAGE_CLASS})`,
	);
	if (postId && imageContainer?.getAttribute("data-id") === postId) {
		imageContainer.classList.add(PROCESSED_IMAGE_CLASS);
		if (window.getComputedStyle(imageContainer).position === "static") {
			imageContainer.style.position = "relative";
		}
		imageContainer.appendChild(
			createAsyncButtonContainer(async () => {
				if (getDetailPostId() !== postId || !imageContainer.isConnected)
					return null;
				const metadata = await getDetailMetadata(postId, imageContainer);
				return getDetailPostId() === postId && imageContainer.isConnected
					? metadata
					: null;
			}, "IMAGE"),
		);
	}

	const pageUrl = window.location.href;
	for (const preview of document.querySelectorAll(
		`.post-preview:not(.${PROCESSED_IMAGE_CLASS})`,
	)) {
		const previewId = getCardPostId(preview);
		const previewContainer = preview.querySelector<HTMLElement>(
			".post-preview-container",
		);
		if (!previewId || !previewContainer) continue;

		preview.classList.add(PROCESSED_IMAGE_CLASS);
		if (window.getComputedStyle(previewContainer).position === "static") {
			previewContainer.style.position = "relative";
		}
		const isCurrentPreview = () =>
			preview.isConnected &&
			getCardPostId(preview) === previewId &&
			window.location.href === pageUrl;
		previewContainer.appendChild(
			createAsyncButtonContainer(async () => {
				if (!isCurrentPreview()) return null;
				const metadata = await fetchPostMetadata(previewId);
				return isCurrentPreview() ? metadata : null;
			}, "IMAGE"),
		);
	}
}
