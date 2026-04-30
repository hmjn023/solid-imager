import { generateMediaFilename } from "@core/domain/media/utils/filename-utils";
import type { SafeMediaSource } from "@core/domain/sources/schemas";
import { APIError, getClient } from "@ext/api";
import type {
	DownloadBulkMessage,
	DownloadMessage,
	ExtendedMessage,
	PostBulkMessage,
	PostDownloadMessage,
	TweetMetadata,
} from "@ext/schema";

const DATE_STRING_LENGTH = 19; // "YYYY-MM-DDTHH-mm-ss"

const EXTENSION_REGEX = /\.([a-z0-9]+)$/i;

function getExtensionFromUrl(url: string): string {
	try {
		const urlObj = new URL(url);
		const pathname = urlObj.pathname;
		const filename = pathname.split("/").pop() || "";
		const extMatch = filename.match(EXTENSION_REGEX);
		if (extMatch) {
			return `.${extMatch[1]}`;
		}
	} catch (_e) {
		// ignore
	}
	return ".png"; // default
}

/**
 * リトライ付きでAPI呼び出しを実行する
 */
async function retryWithBackoff<T>(
	fn: () => Promise<T>,
	maxRetries = 3,
	initialDelay = 1000,
): Promise<T> {
	let lastError: unknown;

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;

			// タイムアウトやネットワークエラーの場合のみリトライ
			if (
				error instanceof APIError &&
				(error.code === "TIMEOUT" || error.code === "NETWORK_ERROR") &&
				attempt < maxRetries - 1
			) {
				const delay = initialDelay * 2 ** attempt;
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}

			// その他のエラーは即座に失敗
			throw error;
		}
	}

	throw lastError;
}

// Fetch sources from API
async function getMediaSources(): Promise<SafeMediaSource[]> {
	try {
		const sources = await retryWithBackoff(async () => {
			const client = await getClient();
			return await client.sources.list();
		});
		return sources as SafeMediaSource[];
	} catch (_error) {
		return [];
	}
}

// Determine which source ID to use
async function getTargetSourceId(): Promise<string | null> {
	// 1. Check local storage for user selection
	const result = await chrome.storage.local.get(["selectedSourceId"]);
	if (result.selectedSourceId) {
		return result.selectedSourceId;
	}

	// 2. Fallback
	const sources = await getMediaSources();
	const twitterSource = sources.find((s) => s.name === "twitter");
	if (twitterSource?.id) {
		return twitterSource.id;
	}
	if (sources.length > 0 && sources[0].id) {
		return sources[0].id;
	}

	return null;
}

async function postDownloads(items: TweetMetadata[]) {
	const mediaSourceId = await getTargetSourceId();
	if (!mediaSourceId) {
		chrome.notifications.create({
			type: "basic",
			iconUrl: "icon.png",
			title: "xtracter Error",
			message:
				"No media source configured. Please set one in the extension popup.",
		});
		return;
	}

	try {
		await retryWithBackoff(async () => {
			const client = await getClient();
			return await client.downloads.start({
				mediaSourceId,
				items,
			});
		});

		chrome.notifications.create({
			type: "basic",
			iconUrl: "icon.png",
			title: "xtracter",
			message: `Successfully queued ${items.length} download(s)`,
		});
	} catch (error) {
		if (error instanceof APIError) {
			chrome.notifications.create({
				type: "basic",
				iconUrl: "icon.png",
				title: "xtracter Error",
				message: `Failed to queue downloads: ${error.message}`,
			});
		} else {
			chrome.notifications.create({
				type: "basic",
				iconUrl: "icon.png",
				title: "xtracter Error",
				message: "An unexpected error occurred. Check console for details.",
			});
		}
	}
}

// Type Guard Functions
function isDownloadMessage(msg: ExtendedMessage): msg is DownloadMessage {
	return msg.type === "DOWNLOAD";
}

function isDownloadBulkMessage(
	msg: ExtendedMessage,
): msg is DownloadBulkMessage {
	return msg.type === "DOWNLOAD_BULK";
}

function isPostDownloadMessage(
	msg: ExtendedMessage,
): msg is PostDownloadMessage {
	return msg.type === "POST_DOWNLOAD";
}

function isPostBulkMessage(msg: ExtendedMessage): msg is PostBulkMessage {
	return msg.type === "POST_BULK";
}

function isGetCookiesMessage(
	msg: ExtendedMessage,
): msg is { type: "GET_COOKIES"; url: string } {
	return msg.type === "GET_COOKIES";
}

chrome.runtime.onMessage.addListener(
	(message: ExtendedMessage, _sender, sendResponse) => {
		// Handle Popup Requests
		if (message.type === "GET_SOURCES") {
			getMediaSources().then((sources) => sendResponse(sources));
			return true; // Async response
		}

		if (isGetCookiesMessage(message)) {
			const url = message.url;
			if (!url) {
				sendResponse([]);
				return;
			}
			chrome.cookies.getAll({ url }, (cookies) => {
				sendResponse(cookies);
			});
			return true;
		}

		if (message.type === "DOWNLOAD_JSON_FROM_POPUP") {
			chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
				const activeTab = tabs[0];
				if (activeTab?.id) {
					chrome.tabs.sendMessage(
						activeTab.id,
						{ type: "GET_METADATA" },
						(response) => {
							if (chrome.runtime.lastError) {
								return;
							}

							if (response && Array.isArray(response)) {
								// Reuse the bulk download logic
								const now = new Date();
								const dateStr = now
									.toISOString()
									.replace(/[:.]/g, "-")
									.slice(0, DATE_STRING_LENGTH);
								const filename = `xtracter/xtracter-${dateStr}.json`;
								const jsonString = JSON.stringify(response, null, 2);
								const dataUrl = `data:application/json;base64,${btoa(unescape(encodeURIComponent(jsonString)))}`;
								chrome.downloads.download(
									{
										url: dataUrl,
										filename,
									},
									() => {
										if (chrome.runtime.lastError) {
											console.error(
												"Download failed:",
												chrome.runtime.lastError.message,
											);
										}
									},
								);
							}
						},
					);
				}
			});
			return true;
		}

		// Handle Content Script Requests
		if (isDownloadMessage(message)) {
			const { targetUrl } = message.data;
			const extension = getExtensionFromUrl(targetUrl);
			// Cast to any to handle string vs Date for createdAt field between core and ext schemas
			const filename = generateMediaFilename(message.data as any, extension);

			chrome.downloads.download(
				{
					url: targetUrl,
					filename: `xtracter/${filename}`,
				},
				() => {
					if (chrome.runtime.lastError) {
						console.error("Download failed:", chrome.runtime.lastError.message);
					}
				},
			);
		} else if (isDownloadBulkMessage(message)) {
			const now = new Date();
			const dateStr = now
				.toISOString()
				.replace(/[:.]/g, "-")
				.slice(0, DATE_STRING_LENGTH);
			const filename = `xtracter/xtracter-${dateStr}.json`;
			const jsonString = JSON.stringify(message.data, null, 2);
			const dataUrl = `data:application/json;base64,${btoa(unescape(encodeURIComponent(jsonString)))}`;
			chrome.downloads.download(
				{
					url: dataUrl,
					filename,
				},
				() => {
					if (chrome.runtime.lastError) {
						console.error("Download failed:", chrome.runtime.lastError.message);
					}
				},
			);
		} else if (isPostDownloadMessage(message)) {
			postDownloads([message.data]);
		} else if (isPostBulkMessage(message)) {
			postDownloads(message.data);
		}

		return true;
	},
);
