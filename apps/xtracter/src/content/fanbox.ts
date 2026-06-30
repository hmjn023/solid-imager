import type { Author, TweetMetadata } from "@ext/schema";
import { querySelectorAllTyped } from "../utils/dom-utils";

const PROCESSED_IMAGE_CLASS = "xtracter-fanbox-image-processed";
const FANBOX_IMAGE_HOSTNAME = "downloads.fanbox.cc";
const FANBOX_POST_PATH = /^\/posts\/(\d+)/;

export function processFanboxMedia(
	processedMetadata: Map<string, TweetMetadata>,
	createButtonContainer: (
		metadata: TweetMetadata,
		type: "IMAGE" | "VIDEO",
	) => HTMLDivElement,
) {
	const match = window.location.pathname.match(FANBOX_POST_PATH);
	if (!match) {
		return;
	}
	const postId = match[1];
	const postUrl = `${window.location.origin}/posts/${postId}`;

	const images = querySelectorAllTyped<HTMLImageElement>(document, "img");
	for (const imageElement of images) {
		const targetUrl = getFanboxImageUrl(imageElement, postId);
		if (!targetUrl || imageElement.dataset.xtracterProcessed === "true") {
			continue;
		}

		const container = imageElement.parentElement;
		if (!container) {
			continue;
		}

		const metadata = extractMetadata(targetUrl, postUrl);
		processedMetadata.set(targetUrl, metadata);

		if (window.getComputedStyle(container).position === "static") {
			container.style.position = "relative";
		}
		container.classList.add(PROCESSED_IMAGE_CLASS);
		imageElement.dataset.xtracterProcessed = "true";
		container.appendChild(createButtonContainer(metadata, "IMAGE"));
	}
}

function getFanboxImageUrl(
	imageElement: HTMLImageElement,
	postId: string,
): string | null {
	const linkedUrl = imageElement.closest("a")?.href;
	const candidates = [linkedUrl, imageElement.currentSrc, imageElement.src];

	for (const candidate of candidates) {
		if (!candidate) {
			continue;
		}

		try {
			const url = new URL(candidate);
			if (
				url.hostname === FANBOX_IMAGE_HOSTNAME &&
				url.pathname.startsWith(`/images/post/${postId}/`)
			) {
				return url.toString();
			}
		} catch {
			// Ignore malformed candidates and try the next image source.
		}
	}

	return null;
}

function extractMetadata(targetUrl: string, postUrl: string): TweetMetadata {
	const hostname = window.location.hostname;
	const creatorId =
		hostname.endsWith(".fanbox.cc") && !hostname.startsWith("www.")
			? hostname.slice(0, -".fanbox.cc".length)
			: "";
	const authorName =
		document.querySelector<HTMLElement>('a[href="/"] h1')?.innerText.trim() ||
		creatorId;
	const authors: Author[] = [];

	if (authorName || creatorId) {
		authors.push({
			name: authorName || creatorId,
			accountId: creatorId || undefined,
			platform: "pixiv-fanbox",
		});
	}

	return {
		targetUrl,
		sourceUrls: [targetUrl, postUrl],
		description:
			document.querySelector("article h1")?.textContent?.trim() ?? "",
		authors,
		userAgent: navigator.userAgent,
	};
}
