import type { Author, TweetMetadata } from "@ext/schema";
import { querySelectorAllTyped, querySelectorTyped } from "../utils/dom-utils";

const PROCESSED_IMAGE_CLASS = "xtracter-image-processed";
const PROCESSED_VIDEO_CLASS = "xtracter-video-processed";
const TWITTER_HANDLE_REGEX = /^[A-Za-z0-9_]{1,15}$/;

export function extractTwitterAuthorIdFromStatusUrl(urlValue: string): string {
	try {
		const url = new URL(urlValue);
		const isTwitterHost =
			url.hostname === "x.com" ||
			url.hostname === "www.x.com" ||
			url.hostname === "twitter.com" ||
			url.hostname === "www.twitter.com";
		if (!isTwitterHost) {
			return "";
		}
		const pathParts = url.pathname.split("/").filter(Boolean);
		if (
			pathParts.length < 3 ||
			pathParts[1] !== "status" ||
			!TWITTER_HANDLE_REGEX.test(pathParts[0] ?? "")
		) {
			return "";
		}
		return `@${pathParts[0]}`;
	} catch {
		return "";
	}
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
	const url = new URL(window.location.href);
	const pathParts = url.pathname.split("/").filter((p) => p);

	let tweetUrl = window.location.href;

	const MIN_PATH_PARTS_FOR_STATUS = 3;
	const STATUS_PART_INDEX = 1;
	const TWEET_ID_PART_INDEX = 2;

	if (
		pathParts.length >= MIN_PATH_PARTS_FOR_STATUS &&
		pathParts[STATUS_PART_INDEX] === "status"
	) {
		tweetUrl = `${url.origin}/${pathParts[0]}/status/${pathParts[TWEET_ID_PART_INDEX]}`;
	}

	return {
		authorId: extractTwitterAuthorIdFromStatusUrl(tweetUrl),
		tweetUrl,
	};
}

function extractMetadata(
	article: HTMLElement | null,
	element: HTMLElement,
	mediaType: "IMAGE" | "VIDEO" = "IMAGE",
): TweetMetadata {
	let tweetText = "";
	let timestamp = "";
	let tweetUrl = window.location.href;
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

	if (!(authorId && tweetUrl) || tweetUrl === window.location.href) {
		const urlMetadata = extractMetadataFromUrl();
		authorId = authorId || urlMetadata.authorId;
		tweetUrl = urlMetadata.tweetUrl || tweetUrl;
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

	const sourceUrls = [tweetUrl];
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
		return tweetUrl;
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

function extractFromArticle(article: HTMLElement) {
	const tweetTextNode = querySelectorTyped<HTMLElement>(
		article,
		'div[data-testid="tweetText"]',
	);
	const tweetText = tweetTextNode?.innerText ?? "";

	const timeNode = article.querySelector("time");
	const timestamp = timeNode ? timeNode.getAttribute("datetime") || "" : "";

	let tweetUrl = window.location.href;
	const timeLink = timeNode?.closest("a");
	if (timeLink) {
		tweetUrl = timeLink.href;
	}

	const userNameNode = article.querySelector('div[data-testid="User-Name"]');
	const authorName = userNameNode?.querySelector("span")?.innerText || "";

	const authorId = extractTwitterAuthorIdFromStatusUrl(tweetUrl);

	return { tweetText, timestamp, tweetUrl, authorName, authorId };
}
