import { generateMediaFilename } from "@solid-imager/core/media/files";

import { APIError, getClient } from "@ext/api";
import type {
	DownloadBulkMessage,
	DownloadItem,
	DownloadMessage,
	ExtendedMessage,
	PostBulkMessage,
	PostDownloadMessage,
} from "@ext/schema";
import { resolveDestination } from "@ext/destination";
import { updateConnectionSettings } from "@ext/connection-settings";
import { retryWithBackoff } from "@ext/utils/retry";
import {
	setApiUrlMessageSchema,
	setSourceMessageSchema,
	type SourcesResponse,
} from "@ext/schema";
import { submitAccountVerificationMessageSchema } from "@ext/schema";

const DATE_STRING_LENGTH = 19; // "YYYY-MM-DDTHH-mm-ss"
const BASE64_CHUNK_SIZE = 0x8000;

const EXTENSION_REGEX = /\.([a-z0-9]+)$/i;

function encodeBase64Utf8(value: string): string {
	const bytes = new TextEncoder().encode(value);
	const chunks: string[] = [];

	for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
		chunks.push(
			String.fromCharCode(
				...bytes.subarray(offset, offset + BASE64_CHUNK_SIZE),
			),
		);
	}

	return btoa(chunks.join(""));
}

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

async function postDownloads(items: DownloadItem[]) {
	try {
		const destination = await resolveDestination();
		const mediaSourceId = destination.selectedSourceId;
		if (!mediaSourceId)
			throw new Error("No media source configured on this server.");
		await retryWithBackoff(() =>
			destination.client.downloads.start({ mediaSourceId, items }),
		);

		void chrome.notifications.create({
			type: "basic",
			iconUrl: "icon.png",
			title: "xtracter",
			message: `Successfully queued ${items.length} download(s)`,
		});
	} catch (error) {
		if (error instanceof APIError) {
			void chrome.notifications.create({
				type: "basic",
				iconUrl: "icon.png",
				title: "xtracter Error",
				message: `Failed to queue downloads: ${error.message}`,
			});
		} else {
			void chrome.notifications.create({
				type: "basic",
				iconUrl: "icon.png",
				title: "xtracter Error",
				message:
					error instanceof Error
						? error.message
						: "Unable to resolve the destination.",
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
	(message: ExtendedMessage, sender, sendResponse) => {
		if (message.type === "SUBMIT_ACCOUNT_VERIFICATION") {
			const parsed = submitAccountVerificationMessageSchema.safeParse(message);
			let senderUrl: URL;
			try {
				senderUrl = new URL(sender.url ?? "");
			} catch {
				sendResponse({ success: false });
				return;
			}
			if (
				!parsed.success ||
				!["x.com", "twitter.com"].includes(senderUrl.hostname) ||
				senderUrl.protocol !== "https:" ||
				senderUrl.pathname
					.replace(/^\//, "")
					.replace(/\/$/, "")
					.toLowerCase() !== parsed.data.profile.username.toLowerCase()
			) {
				sendResponse({ success: false });
				return;
			}
			void getClient()
				.then((client) =>
					client.authors.submitAccountVerification({
						verificationId: parsed.data.verificationId,
						profile: parsed.data.profile,
					}),
				)
				.then(() => sendResponse({ success: true }))
				.catch((error: unknown) => {
					sendResponse({ success: false });
					void chrome.notifications.create({
						type: "basic",
						iconUrl: "icon.png",
						title: "xtracter アカウント確認",
						message:
							error instanceof Error
								? error.message
								: "Managerへの送信に失敗しました。接続設定を確認してプロフィールを再読み込みしてください。",
					});
				});
			return true;
		}
		// Handle Popup Requests
		if (
			message.type === "GET_SOURCES" ||
			message.type === "SET_API_URL" ||
			message.type === "SET_SOURCE"
		) {
			const respond = async (): Promise<SourcesResponse> => {
				try {
					let settings;
					if (message.type === "SET_API_URL") {
						const parsed = setApiUrlMessageSchema.parse(message);
						settings = await updateConnectionSettings((current) => ({
							...current,
							apiUrl: parsed.apiUrl,
							generation: current.generation + 1,
						}));
					} else if (message.type === "SET_SOURCE") {
						const parsed = setSourceMessageSchema.parse(message);
						settings = await updateConnectionSettings((current) => {
							if (
								current.apiUrl !== parsed.apiUrl ||
								current.generation !== parsed.generation
							)
								throw new Error(
									"Connection settings changed. Reload sources before selecting.",
								);
							return {
								...current,
								generation: current.generation + 1,
								selectedSourceIds: {
									...current.selectedSourceIds,
									[parsed.apiUrl]: parsed.sourceId,
								},
							};
						});
					}
					const destination = await resolveDestination(settings);
					return {
						success: true,
						apiUrl: destination.settings.apiUrl,
						generation: destination.settings.generation,
						sources: destination.sources,
						selectedSourceId: destination.selectedSourceId,
					};
				} catch (error) {
					return {
						success: false,
						error:
							error instanceof Error
								? error.message
								: "Failed to load sources.",
					};
				}
			};
			void respond().then(sendResponse);
			return true;
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
								const dataUrl = `data:application/json;base64,${encodeBase64Utf8(jsonString)}`;
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
			const filename = generateMediaFilename(
				{
					...message.data,
					authors: message.data.authors?.map((author) => ({
						...author,
						observedAt: author.observedAt
							? new Date(author.observedAt)
							: undefined,
					})),
					createdAt: message.data.createdAt
						? new Date(message.data.createdAt)
						: undefined,
				},
				extension,
			);

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
			const dataUrl = `data:application/json;base64,${encodeBase64Utf8(jsonString)}`;
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
			void postDownloads([message.data]);
		} else if (isPostBulkMessage(message)) {
			void postDownloads(message.data);
		}

		return true;
	},
);
