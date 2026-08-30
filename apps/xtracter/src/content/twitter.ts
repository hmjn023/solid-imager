import type { Author, TweetMetadata } from "@ext/schema";
import { querySelectorAllTyped, querySelectorTyped } from "../utils/dom-utils";

const PROCESSED_IMAGE_CLASS = "xtracter-image-processed";
const PROCESSED_VIDEO_CLASS = "xtracter-video-processed";
const TWITTER_HANDLE_REGEX = /^[A-Za-z0-9_]{1,15}$/;

function getTwitterStatusPath(urlValue: string): string[] | null {
	try {
		const url = new URL(urlValue);
		const isTwitterHost =
			url.hostname === "x.com" ||
			url.hostname === "www.x.com" ||
			url.hostname === "twitter.com" ||
			url.hostname === "www.twitter.com";
		return isTwitterHost ? url.pathname.split("/").filter(Boolean) : null;
	} catch {
		return null;
	}
}

export function isTwitterStatusUrl(urlValue: string): boolean {
	const pathParts = getTwitterStatusPath(urlValue);
	return (
		!!pathParts &&
		((pathParts.length >= 3 && pathParts[1] === "status") ||
			(pathParts.length >= 4 &&
				pathParts[0] === "i" &&
				pathParts[1] === "web" &&
				pathParts[2] === "status"))
	);
}

export function extractTwitterAuthorIdFromStatusUrl(urlValue: string): string {
	const pathParts = getTwitterStatusPath(urlValue);
	if (
		!pathParts ||
		pathParts.length < 3 ||
		pathParts[1] !== "status" ||
		pathParts[0] === "i" ||
		!TWITTER_HANDLE_REGEX.test(pathParts[0] ?? "")
	) {
		return "";
	}
	return `@${pathParts[0]}`;
}

export function processTwitterMedia(
	processedMetadata: Map<string, TweetMetadata>,
	createButtonContainer: (
		metadata: TweetMetadata,
		type: "IMAGE" | "VIDEO",
	) => HTMLDivElement,
) {
	processImages(processedMetadata, createButtonContainer);
	processVideos(processedMetadata, createButtonContainer);
}

function processImages(
	processedMetadata: Map<string, TweetMetadata>,
	createButtonContainer: (
		metadata: TweetMetadata,
		type: "IMAGE" | "VIDEO",
	) => HTMLDivElement,
) {
	const images = querySelectorAllTyped<HTMLImageElement>(
		document,
		'img[src*="pbs.twimg.com/media"]',
	);
	for (const imageElement of images) {
		if (imageElement.parentElement?.classList.contains(PROCESSED_IMAGE_CLASS)) {
			continue;
		}

		const container = imageElement.parentElement;
		if (container) {
			// Extract metadata first
			const tweetArticle = findTweetArticle(imageElement);
			const metadata = extractMetadata(tweetArticle, imageElement, "IMAGE");

			// Store metadata for bulk export
			if (metadata.targetUrl && !processedMetadata.has(metadata.targetUrl)) {
				processedMetadata.set(metadata.targetUrl, metadata);
			}

			const style = window.getComputedStyle(container);
			if (style.position === "static") {
				container.style.position = "relative";
			}
			container.classList.add(PROCESSED_IMAGE_CLASS);
			const btnContainer = createButtonContainer(metadata, "IMAGE");
			container.appendChild(btnContainer);
		}
	}
}

function processVideos(
	processedMetadata: Map<string, TweetMetadata>,
	createButtonContainer: (
		metadata: TweetMetadata,
		type: "IMAGE" | "VIDEO",
	) => HTMLDivElement,
) {
	const videoComponents = querySelectorAllTyped<HTMLElement>(
		document,
		'div[data-testid="videoComponent"]',
	);
	for (const videoComponent of videoComponents) {
		const container = videoComponent.parentElement;
		if (!container || container.classList.contains(PROCESSED_VIDEO_CLASS)) {
			continue;
		}
		if (container.querySelector(`.${PROCESSED_VIDEO_CLASS}`)) {
			continue;
		}

		const tweetArticle = findTweetArticle(videoComponent);
		const metadata = extractMetadata(tweetArticle, container, "VIDEO");
		if (!metadata.targetUrl) {
			// A video can only be downloaded through its post URL. Do not
			// enqueue the current timeline URL (for example /home) as a video.
			continue;
		}

		// Store metadata for bulk export
		if (metadata.targetUrl && !processedMetadata.has(metadata.targetUrl)) {
			processedMetadata.set(metadata.targetUrl, metadata);
		}

		const style = window.getComputedStyle(container);
		if (style.position === "static") {
			container.style.position = "relative";
		}

		container.classList.add(PROCESSED_VIDEO_CLASS);

		const btnContainer = createButtonContainer(metadata, "VIDEO");
		btnContainer.style.top = "10px";
		btnContainer.style.right = "10px";

		container.appendChild(btnContainer);
	}
}

function findTweetArticle(element: HTMLElement): HTMLElement | null {
	const closest = element.closest("article");
	if (closest) {
		return closest;
	}

	const layer =
		element.closest('[data-testid="layers"]') ||
		document.querySelector('[data-testid="layers"]');
	if (layer) {
		const article = querySelectorTyped<HTMLElement>(layer, "article");
		if (article) {
			return article;
		}
	}

	const articles = querySelectorAllTyped<HTMLElement>(document, "article");
	if (articles.length === 1) {
		return articles[0];
	}

	return null;
}

function extractMetadataFromUrl(): { authorId: string; tweetUrl: string } {
	const tweetUrl = window.location.href;
	const authorId = extractTwitterAuthorIdFromStatusUrl(tweetUrl);

	return {
		authorId,
		tweetUrl: isTwitterStatusUrl(tweetUrl) ? tweetUrl : "",
	};
}

function extractMetadata(
	article: HTMLElement | null,
	element: HTMLElement,
	mediaType: "IMAGE" | "VIDEO" = "IMAGE",
): TweetMetadata {
	let tweetText = "";
	let timestamp = "";
	let tweetUrl = "";
	let authorName = "";
	let authorId = "";

	if (article) {
		const extracted = extractFromArticle(article);
		tweetText = extracted.tweetText;
		timestamp = extracted.timestamp;
		tweetUrl = extracted.tweetUrl;
		authorName = extracted.authorName;
		authorId = extracted.authorId;
	}

	if (!tweetUrl) {
		const urlMetadata = extractMetadataFromUrl();
		authorId = authorId || urlMetadata.authorId;
		tweetUrl = urlMetadata.tweetUrl;
	}

	const targetUrl = determineTargetUrl(element, mediaType, tweetUrl);

	const authors: Author[] = [];
	if (authorName || authorId) {
		authors.push({
			name: authorName || authorId,
			accountId: authorId,
			platform: "twitter",
		});
	}

	const sourceUrls = tweetUrl ? [tweetUrl] : [];
	if (mediaType === "IMAGE") {
		sourceUrls.unshift(targetUrl);
	}

	return {
		targetUrl,
		sourceUrls,
		description: tweetText,
		createdAt: timestamp,
		authors,
		userAgent: navigator.userAgent,
	};
}

function determineTargetUrl(
	element: HTMLElement,
	mediaType: "IMAGE" | "VIDEO",
	tweetUrl: string,
): string {
	if (mediaType === "VIDEO") {
		return isTwitterStatusUrl(tweetUrl) ? tweetUrl : "";
	}

	try {
		if (!(element instanceof HTMLImageElement)) {
			return element.getAttribute("src") ?? "";
		}
		const url = new URL(element.src);
		url.searchParams.set("name", "orig");
		return url.toString();
	} catch {
		if (element instanceof HTMLImageElement) {
			return element.src;
		}
		return element.getAttribute("src") ?? "";
	}
}

export function extractFromArticle(article: HTMLElement) {
	const tweetTextNode = querySelectorTyped<HTMLElement>(
		article,
		'div[data-testid="tweetText"]',
	);
	const tweetText = tweetTextNode?.innerText ?? "";

	const timeNode = article.querySelector("time");
	const timestamp = timeNode ? timeNode.getAttribute("datetime") || "" : "";

	const timeLink = timeNode?.closest<HTMLAnchorElement>("a");
	const tweetUrl =
		timeLink && isTwitterStatusUrl(timeLink.href) ? timeLink.href : "";

	const userNameNode = article.querySelector('div[data-testid="User-Name"]');
	const authorName = userNameNode?.querySelector("span")?.innerText || "";

	const authorId = extractTwitterAuthorIdFromStatusUrl(tweetUrl);

	return { tweetText, timestamp, tweetUrl, authorName, authorId };
}
