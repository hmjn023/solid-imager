import type { DownloadItem } from "@ext/schema";
import type { TwitterPostIdentity } from "./twitter-identities";
// Keep this entry free of runtime shared-package imports: manifest content scripts are classic scripts.
function isIdentity(value: unknown): value is TwitterPostIdentity {
	if (!value || typeof value !== "object") return false;
	return (
		"postId" in value &&
		typeof value.postId === "string" &&
		/^[0-9]+$/.test(value.postId) &&
		"remoteId" in value &&
		typeof value.remoteId === "string" &&
		/^[0-9]+$/.test(value.remoteId) &&
		"username" in value &&
		typeof value.username === "string" &&
		/^[A-Za-z0-9_]{1,15}$/.test(value.username) &&
		"displayName" in value &&
		typeof value.displayName === "string" &&
		value.displayName.trim().length > 0 &&
		"observedAt" in value &&
		typeof value.observedAt === "string" &&
		Number.isFinite(Date.parse(value.observedAt))
	);
}
const cache = new Map<string, TwitterPostIdentity>();
export function observeTwitterAccounts() {
	observeAccountVerification();
	window.addEventListener("message", (event) => {
		if (event.source !== window || event.origin !== window.location.origin)
			return;
		const packet: unknown = event.data;
		if (
			!packet ||
			typeof packet !== "object" ||
			!("channel" in packet) ||
			packet.channel !== "solid-imager-xtracter-twitter-identities" ||
			!("identities" in packet) ||
			!Array.isArray(packet.identities) ||
			packet.identities.length > 2000
		)
			return;
		for (const candidate of packet.identities) {
			if (!isIdentity(candidate)) continue;
			const identity = candidate;
			cache.set(identity.postId, identity);
			if (cache.size > 2000) {
				const first = cache.keys().next().value;
				if (first) cache.delete(first);
			}
		}
	});
	window.postMessage(
		{ channel: "solid-imager-xtracter-twitter-identities-request" },
		window.location.origin,
	);
}

function observeAccountVerification() {
	const verificationId = new URLSearchParams(window.location.hash.slice(1)).get(
		"solid-imager-account-verification",
	);
	const username = window.location.pathname.match(
		/^\/([A-Za-z0-9_]{1,15})\/?$/,
	)?.[1];
	if (
		!verificationId ||
		!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
			verificationId,
		) ||
		!username
	)
		return;
	let sent = false;
	window.addEventListener("message", (event) => {
		if (
			sent ||
			event.source !== window ||
			event.origin !== window.location.origin
		)
			return;
		const packet: unknown = event.data;
		if (
			!packet ||
			typeof packet !== "object" ||
			!("channel" in packet) ||
			packet.channel !== "solid-imager-xtracter-twitter-profile" ||
			!("profile" in packet)
		)
			return;
		const profile = packet.profile;
		if (
			!profile ||
			typeof profile !== "object" ||
			!("remoteId" in profile) ||
			typeof profile.remoteId !== "string" ||
			!/^[0-9]+$/.test(profile.remoteId) ||
			!("username" in profile) ||
			typeof profile.username !== "string" ||
			profile.username.toLowerCase() !== username.toLowerCase() ||
			!("displayName" in profile) ||
			typeof profile.displayName !== "string" ||
			!profile.displayName.trim()
		)
			return;
		sent = true;
		// Only this explicitly opened verification profile is forwarded, never browsing history.
		void chrome.runtime
			.sendMessage({
				type: "SUBMIT_ACCOUNT_VERIFICATION",
				verificationId,
				profile: {
					remoteId: profile.remoteId,
					username: profile.username,
					displayName: profile.displayName,
				},
			})
			.catch(() => {
				sent = false;
			});
	});
	window.postMessage(
		{ channel: "solid-imager-xtracter-twitter-profile-request" },
		window.location.origin,
	);
}
export function enrichTwitterMetadata(item: DownloadItem): DownloadItem {
	for (const rawUrl of item.sourceUrls ?? []) {
		let url: URL;
		try {
			url = new URL(rawUrl);
		} catch {
			continue;
		}
		if (
			!["x.com", "twitter.com", "www.x.com", "www.twitter.com"].includes(
				url.hostname,
			)
		)
			continue;
		const postId = url.pathname.match(
			/^\/(?:[A-Za-z0-9_]+|i\/web)\/status\/([0-9]+)(?:\/|$)/,
		)?.[1];
		const account = postId ? cache.get(postId) : undefined;
		if (!account) continue;
		return {
			...item,
			authors: [
				{
					name: account.displayName,
					accountId: account.username,
					platform: "twitter",
					remoteId: account.remoteId,
					profileUrl: `https://x.com/${account.username}`,
					observedAt: account.observedAt,
				},
			],
		};
	}
	return item;
}
