import {
	enrichTwitterMetadata,
	observeTwitterAccounts,
} from "./twitter-account-cache";
import type { DownloadItem } from "@ext/schema";
import { processDanbooruMedia } from "./danbooru";
import { processFanboxMedia } from "./fanbox";
import { processPixivMedia } from "./pixiv";
import { processTwitterMedia } from "./twitter";

const OBSERVER_CONFIG: MutationObserverInit = {
	childList: true,
	subtree: true,
	...(window.location.hostname === "www.pixiv.net"
		? {
				attributes: true,
				attributeFilter: ["src", "srcset", "href", "poster", "content"],
			}
		: {}),
};
const ERROR_TIMEOUT_MS = 2000;

function createButtonContainer(
	metadata: DownloadItem,
	type: "IMAGE" | "VIDEO" = "IMAGE",
): HTMLDivElement {
	const container = document.createElement("div");
	container.style.position = "absolute";
	container.style.top = "5px";
	container.style.right = "5px";
	container.style.zIndex = "9999";
	container.style.display = "flex";
	container.style.gap = "5px";

	// Stop propagation on container to prevent clicking image/post
	container.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
	});

	const dlBtn = createButton(type === "VIDEO" ? "DL VIDEO" : "DL", "#000", () =>
		handleAction(metadata, "DOWNLOAD", type),
	);
	const postBtn = createButton("POST", "#0056b3", () =>
		handleAction(metadata, "POST_DOWNLOAD", type),
	);

	container.appendChild(dlBtn);
	container.appendChild(postBtn);
	return container;
}

export function createAsyncButtonContainer(
	fetchMetadata: () => Promise<DownloadItem | null>,
	type: "IMAGE" | "VIDEO" = "IMAGE",
	allowDownload = true,
): HTMLDivElement {
	const container = document.createElement("div");
	Object.assign(container.style, {
		position: "absolute",
		top: "5px",
		right: "5px",
		zIndex: "9999",
		display: "flex",
		gap: "5px",
	});

	// Stop propagation on container to prevent clicking image/post
	container.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
	});

	const dlBtn = createButton(
		type === "VIDEO" ? "DL VIDEO" : "DL",
		"#000",
		() => {
			handleAsyncAction("DOWNLOAD").catch(() => {
				/* ignore */
			});
		},
	);
	const postBtn = createButton("POST", "#0056b3", () => {
		handleAsyncAction("POST_DOWNLOAD").catch(() => {
			/* ignore */
		});
	});

	let resetTimeout: ReturnType<typeof setTimeout> | undefined;
	const resetLabels = () => {
		dlBtn.innerText = type === "VIDEO" ? "DL VIDEO" : "DL";
		postBtn.innerText = "POST";
		container.removeAttribute("title");
	};
	const handleAsyncAction = async (
		actionType: "DOWNLOAD" | "POST_DOWNLOAD",
	) => {
		clearTimeout(resetTimeout);
		resetLabels();
		try {
			// Show loading state
			dlBtn.innerText = "⏳";
			postBtn.innerText = "⏳";
			dlBtn.disabled = true;
			postBtn.disabled = true;

			const metadata = await fetchMetadata();
			if (metadata) {
				handleAction(metadata, actionType, type);
				resetLabels();
			} else {
				throw new Error(
					"Could not load this image. Try again on the artwork page.",
				);
			}
		} catch (error) {
			dlBtn.innerText = "❌";
			postBtn.innerText = "❌";
			container.title =
				error instanceof Error ? error.message : "Could not load this image.";
			resetTimeout = setTimeout(resetLabels, ERROR_TIMEOUT_MS);
		} finally {
			dlBtn.disabled = false;
			postBtn.disabled = false;
		}
	};

	if (allowDownload) container.appendChild(dlBtn);
	container.appendChild(postBtn);
	return container;
}

function createButton(
	text: string,
	bgColor: string,
	onClick: () => void,
): HTMLButtonElement {
	const button = document.createElement("button");
	button.type = "button";
	button.innerText = text;
	button.style.backgroundColor = bgColor;
	button.style.color = "white";
	button.style.border = "none";
	button.style.borderRadius = "4px";
	button.style.padding = "4px 8px";
	button.style.cursor = "pointer";
	button.style.fontWeight = "bold";
	button.style.fontSize = "12px";
	button.style.opacity = "0.8";
	button.style.transition = "opacity 0.2s";

	button.addEventListener("mouseover", () => {
		button.style.opacity = "1";
	});
	button.addEventListener("mouseout", () => {
		button.style.opacity = "0.8";
	});

	button.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		onClick();
	});

	return button;
}

function handleAction(
	originalMetadata: DownloadItem,
	type: "DOWNLOAD" | "POST_DOWNLOAD",
	mediaType: "IMAGE" | "VIDEO",
) {
	const metadata = enrichTwitterMetadata(originalMetadata);
	const tweetUrl =
		metadata.sourceUrls && metadata.sourceUrls.length > 0
			? metadata.sourceUrls[0]
			: metadata.targetUrl;

	if (mediaType === "VIDEO") {
		chrome.runtime.sendMessage(
			{ type: "GET_COOKIES", url: tweetUrl },
			(cookies: unknown) => {
				if (Array.isArray(cookies)) {
					metadata.cookies = cookies;
				}
				void chrome.runtime.sendMessage({ type, data: metadata });
			},
		);
	} else {
		void chrome.runtime.sendMessage({ type, data: metadata });
	}
}

const processedMetadata = new Map<string, DownloadItem>();

chrome.runtime.onMessage.addListener(
	(message: unknown, _sender, sendResponse) => {
		if (
			typeof message === "object" &&
			message !== null &&
			"type" in message &&
			message.type === "GET_METADATA"
		) {
			const allMetadata = Array.from(processedMetadata.values()).map(
				enrichTwitterMetadata,
			);
			sendResponse(allMetadata);
		}
	},
);

function processMedia() {
	const hostname = window.location.hostname;
	if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
		processTwitterMedia(processedMetadata, createButtonContainer);
	} else if (hostname === "fanbox.cc" || hostname.endsWith(".fanbox.cc")) {
		processFanboxMedia(processedMetadata, createButtonContainer);
	} else if (hostname === "www.pixiv.net") {
		processPixivMedia(processedMetadata, (fetchMetadata) =>
			createAsyncButtonContainer(fetchMetadata, "IMAGE", false),
		);
	} else if (hostname.includes("danbooru.donmai.us")) {
		processDanbooruMedia(createButtonContainer, createAsyncButtonContainer);
	}
}

if (["x.com", "twitter.com"].includes(window.location.hostname))
	observeTwitterAccounts();

const observer = new MutationObserver((mutations) => {
	let shouldProcess = false;
	for (const mutation of mutations) {
		if (mutation.type === "attributes" || mutation.addedNodes.length > 0) {
			shouldProcess = true;
			break;
		}
	}
	if (shouldProcess) {
		processMedia();
	}
});

observer.observe(document.body, OBSERVER_CONFIG);

if (window.location.hostname === "www.pixiv.net") {
	// Decoded image/video sources may become available without another DOM mutation.
	for (const event of ["load", "loadedmetadata"]) {
		document.addEventListener(
			event,
			(e) => {
				if (
					e.target instanceof HTMLImageElement ||
					e.target instanceof HTMLVideoElement
				)
					processMedia();
			},
			true,
		);
	}
}

processMedia();
