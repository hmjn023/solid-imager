import type { DownloadItem } from "@ext/schema";
import { ugoiraMetadataSchema } from "@solid-imager/core/media";
import { z } from "zod";

const ARTWORK_PATH = /^\/(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?artworks\/(\d+)\/?$/;
const IMAGE_FILENAME =
	/\/(\d+)(?:-[a-z0-9]+)?_p(\d+)(?:[_-][^/]*)?\.[a-z0-9]+$/i;
const UGOIRA_POSTER_FILENAME =
	/\/(\d+)(?:-[a-z0-9]+)?_ugoira\d+(?:[_-][^/]*)?\.[a-z0-9]+$/i;
const ARTWORK_PREVIEW_FILENAME =
	/\/(\d+)(?:-[a-z0-9]+)?_master\d+\.[a-z0-9]+$/i;
const ANIMATION_PLAYER_SELECTOR =
	"main figure canvas, main figure video, article figure canvas, article figure video";
const UGOIRA_ZIP_FILENAME = /\/(\d+)(?:-[a-z0-9]+)?_ugoira\d+x\d+\.zip$/;
const pixivArtworkResponseSchema = z.object({
	error: z.literal(false),
	body: z.object({
		id: z.string().regex(/^\d+$/),
		illustType: z.union([z.literal(0), z.literal(1), z.literal(2)]),
		pageCount: z.number().int().positive(),
		title: z.string(),
		description: z.string(),
		userId: z.string().regex(/^\d+$/),
		userName: z.string().min(1),
		createDate: z.iso.datetime({ offset: true }),
		tags: z.object({ tags: z.array(z.object({ tag: z.string() })) }),
	}),
});
const pixivPagesResponseSchema = z.object({
	error: z.literal(false),
	body: z.array(z.object({ urls: z.object({ original: z.url() }) })).min(1),
});
const pixivUgoiraResponseSchema = z.object({
	error: z.literal(false),
	body: ugoiraMetadataSchema.and(z.object({ originalSrc: z.url() })),
});

interface ImageControl {
	key: string;
	button: HTMLDivElement;
}

const imageControls = new WeakMap<HTMLElement, ImageControl>();
const pendingArtworks = new Map<string, Promise<DownloadItem[] | null>>();

/** Accept only artwork permalinks on Pixiv, including localized paths. */
export function getPixivArtworkId(value: string): string | null {
	try {
		const url = new URL(value);
		if (url.origin !== "https://www.pixiv.net") return null;
		return url.pathname.match(ARTWORK_PATH)?.[1] ?? null;
	} catch {
		return null;
	}
}

/** Match the actual image identity without guessing its original URL or extension. */
export function getPixivImagePage(
	value: string,
	artworkId: string,
): number | null {
	const identity = imageIdentity(value);
	return identity?.artworkId === artworkId ? identity.page : null;
}

function imageIdentity(
	value: string,
): { artworkId: string; page: number } | null {
	try {
		const url = new URL(value);
		if (
			url.protocol !== "https:" ||
			!(url.hostname === "pximg.net" || url.hostname.endsWith(".pximg.net")) ||
			url.port ||
			url.username ||
			url.password
		)
			return null;
		const match = url.pathname.match(IMAGE_FILENAME);
		if (!match) return null;
		const page = Number(match[2]);
		return Number.isSafeInteger(page) ? { artworkId: match[1], page } : null;
	} catch {
		return null;
	}
}

function ugoiraPosterId(value: string, allowPreview: boolean): string | null {
	try {
		const url = new URL(value);
		if (url.origin !== "https://i.pximg.net" || url.username || url.password)
			return null;
		return (
			url.pathname.match(UGOIRA_POSTER_FILENAME)?.[1] ??
			(allowPreview
				? (url.pathname.match(ARTWORK_PREVIEW_FILENAME)?.[1] ?? null)
				: null)
		);
	} catch {
		return null;
	}
}

function descriptionText(html: string): string {
	// Parse an inert document only; no external markup is inserted into the page.
	const document = new DOMParser().parseFromString(
		html.replace(/<br\s*\/?\s*>|<\/p>/gi, "\n"),
		"text/html",
	);
	for (const element of document.querySelectorAll("script, style"))
		element.remove();
	return document.body.textContent?.trim() ?? "";
}

/** Validate both Ajax responses and preserve each page's exact original CDN URL. */
export function parsePixivMetadata(
	artworkResponse: unknown,
	mediaResponse: unknown,
	artworkId: string,
): DownloadItem[] | null {
	const artwork = pixivArtworkResponseSchema.safeParse(artworkResponse);
	if (!artwork.success || artwork.data.body.id !== artworkId) return null;
	const body = artwork.data.body;
	if (body.illustType === 2) {
		const ugoira = pixivUgoiraResponseSchema.safeParse(mediaResponse);
		if (!ugoira.success || body.pageCount !== 1) return null;
		const url = new URL(ugoira.data.body.originalSrc);
		if (
			url.origin !== "https://i.pximg.net" ||
			url.username ||
			url.password ||
			!url.pathname.startsWith("/img-zip-ugoira/") ||
			url.pathname.match(UGOIRA_ZIP_FILENAME)?.[1] !== artworkId
		)
			return null;
		return [
			{
				...buildMetadata(body, ugoira.data.body.originalSrc),
				ugoira: { frames: ugoira.data.body.frames },
			},
		];
	}
	const pages = pixivPagesResponseSchema.safeParse(mediaResponse);
	if (!pages.success) return null;
	if (body.pageCount !== pages.data.body.length) return null;
	if (
		pages.data.body.some(
			(page, index) =>
				getPixivImagePage(page.urls.original, artworkId) !== index ||
				!new URL(page.urls.original).pathname.startsWith("/img-original/"),
		)
	)
		return null;
	return pages.data.body.map(({ urls }, position) => ({
		...buildMetadata(body, urls.original),
		sourcePost: { platform: "pixiv" as const, postId: body.id, position },
	}));
}

function buildMetadata(
	body: z.infer<typeof pixivArtworkResponseSchema>["body"],
	targetUrl: string,
): DownloadItem {
	const description = [body.title, descriptionText(body.description)]
		.filter(Boolean)
		.join("\n\n");
	const author = {
		name: body.userName,
		accountId: body.userId,
		remoteId: body.userId,
		platform: "pixiv" as const,
		profileUrl: `https://www.pixiv.net/users/${body.userId}`,
		observedAt: new Date().toISOString(),
	};
	const artworkUrl = `https://www.pixiv.net/artworks/${body.id}`;
	return {
		targetUrl,
		// The download worker uses the final source URL as its Referer header.
		sourceUrls: [targetUrl, artworkUrl],
		description,
		createdAt: body.createDate,
		authors: [author],
		tags: [
			...new Set(body.tags.tags.map(({ tag }) => tag.trim()).filter(Boolean)),
		].map((name) => ({ name, type: "positive", source: "pixiv" })),
		userAgent: navigator.userAgent,
	};
}

async function fetchArtwork(artworkId: string): Promise<DownloadItem[] | null> {
	try {
		const detailResponse = await fetch(`/ajax/illust/${artworkId}`, {
			credentials: "same-origin",
		});
		if (!detailResponse.ok) return null;
		const detail: unknown = await detailResponse.json();
		const artwork = pixivArtworkResponseSchema.safeParse(detail);
		if (!artwork.success || artwork.data.body.id !== artworkId) return null;
		const endpoint =
			artwork.data.body.illustType === 2 ? "ugoira_meta" : "pages";
		const mediaResponse = await fetch(`/ajax/illust/${artworkId}/${endpoint}`, {
			credentials: "same-origin",
		});
		if (!mediaResponse.ok) return null;
		const media: unknown = await mediaResponse.json();
		return parsePixivMetadata(artwork.data, media, artworkId);
	} catch {
		return null;
	}
}

function getArtwork(artworkId: string): Promise<DownloadItem[] | null> {
	const pending = pendingArtworks.get(artworkId);
	if (pending) return pending;
	const request = fetchArtwork(artworkId).finally(() =>
		pendingArtworks.delete(artworkId),
	);
	pendingArtworks.set(artworkId, request);
	return request;
}

function imagePage(
	image: HTMLImageElement,
	artworkId: string,
): number | "ugoira" | null {
	// src changes before currentSrc while a recycled image loads its next page.
	for (const candidate of [image.src, image.currentSrc, image.dataset.src]) {
		if (!candidate) continue;
		const identity = imageIdentity(candidate);
		if (identity)
			return identity.artworkId === artworkId ? identity.page : null;
		const ugoiraId = ugoiraPosterId(candidate, true);
		if (ugoiraId) return ugoiraId === artworkId ? "ugoira" : null;
	}
	return null;
}

function isImage(element: HTMLElement): element is HTMLImageElement {
	return element.tagName === "IMG";
}

function mediaPage(
	media: HTMLElement,
	artworkId: string,
): number | "ugoira" | null {
	if (isImage(media)) return imagePage(media, artworkId);
	if (media.tagName === "VIDEO") {
		const poster = media.getAttribute("poster");
		if (poster) {
			const identity = ugoiraPosterId(poster, true);
			if (identity) return identity === artworkId ? "ugoira" : null;
		}
	}
	// Current Pixiv pages bootstrap without artwork preload data. The primary
	// player is only a candidate: POST validates illustType and requires frames.
	return document.querySelector(ANIMATION_PLAYER_SELECTOR) === media
		? "ugoira"
		: null;
}

/** Add POST controls to the artwork's images and primary animation player. */
export function processPixivMedia(
	processedMetadata: Map<string, DownloadItem>,
	createAsyncPostButtonContainer: (
		fetchMetadata: () => Promise<DownloadItem | null>,
	) => HTMLDivElement,
): void {
	const artworkId = getPixivArtworkId(window.location.href);
	const animationContainers = new Set<HTMLElement>();
	for (const image of document.querySelectorAll<HTMLElement>(
		"img, canvas, video",
	)) {
		let page = artworkId ? mediaPage(image, artworkId) : null;
		const container = image.parentElement;
		if (page === "ugoira" && container) {
			if (animationContainers.has(container)) page = null;
			else animationContainers.add(container);
		}
		const key =
			artworkId !== null && page !== null ? `${artworkId}:${page}` : null;
		const control = imageControls.get(image);
		if (
			control?.key === key &&
			control.button.parentElement === image.parentElement
		)
			continue;
		if (control) {
			control.button.remove();
			imageControls.delete(image);
		}
		if (!artworkId || page === null || !key || !container) continue;
		const targetPage = page;
		const isCurrentImage = () =>
			image.isConnected &&
			getPixivArtworkId(window.location.href) === artworkId &&
			mediaPage(image, artworkId) === targetPage;
		const button = createAsyncPostButtonContainer(async () => {
			if (!isCurrentImage()) return null;
			const items = await getArtwork(artworkId);
			if (!items || !isCurrentImage()) return null;
			const item = items[targetPage === "ugoira" ? 0 : targetPage];
			if (!item || (targetPage === "ugoira" && !item.ugoira)) return null;
			for (const item of items) processedMetadata.set(item.targetUrl, item);
			return item;
		});
		if (window.getComputedStyle(container).position === "static")
			container.style.position = "relative";
		container.appendChild(button);
		imageControls.set(image, { key, button });
	}
}
