import {
	collectTwitterIdentities,
	collectTwitterProfile,
	type TwitterPostIdentity,
} from "./twitter-identities";

// This entry runs in MAIN at document_start. It observes responses already requested by X;
// it does not issue additional requests or read/forward authorization headers or cookies.
const cache = new Map<string, TwitterPostIdentity>();
const profiles = new Map<
	string,
	NonNullable<ReturnType<typeof collectTwitterProfile>>
>();
const channel = "solid-imager-xtracter-twitter-identities";
function publish(identities: TwitterPostIdentity[]) {
	if (identities.length)
		window.postMessage({ channel, identities }, window.location.origin);
}
function observe(payload: unknown) {
	const profile = collectTwitterProfile(payload);
	if (profile) {
		profiles.set(profile.username.toLowerCase(), profile);
		if (profiles.size > 200) {
			const first = profiles.keys().next().value;
			if (first) profiles.delete(first);
		}
		window.postMessage(
			{ channel: "solid-imager-xtracter-twitter-profile", profile },
			window.location.origin,
		);
	}
	const identities = collectTwitterIdentities(
		payload,
		new Date().toISOString(),
	);
	for (const identity of identities) {
		cache.set(identity.postId, identity);
		if (cache.size > 2000) {
			const first = cache.keys().next().value;
			if (first) cache.delete(first);
		}
	}
	publish(identities);
}
function isPostResponse(url: string): boolean {
	try {
		const parsed = new URL(url, window.location.origin);
		return (
			parsed.origin === window.location.origin &&
			parsed.pathname.startsWith("/i/api/graphql/")
		);
	} catch {
		return false;
	}
}
async function observeResponse(response: Response) {
	if (
		!isPostResponse(response.url) ||
		!response.ok ||
		!response.headers.get("content-type")?.includes("json")
	)
		return;
	const clone = response.clone();
	try {
		const body = await clone.text();
		if (body.length <= 5_000_000) observe(JSON.parse(body));
	} catch {
		/* Response decoding cannot interrupt X. */
	}
}
const fetchOriginal = window.fetch;
window.fetch = async function (...args: Parameters<typeof fetch>) {
	const response = await fetchOriginal.apply(this, args);
	void observeResponse(response);
	return response;
};
// X also uses XMLHttpRequest. Listen without modifying the response or request.
// Preserve the receiver when delegating to the native XHR method.
// eslint-disable-next-line typescript/unbound-method
const sendOriginal = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function (
	...args: Parameters<XMLHttpRequest["send"]>
) {
	this.addEventListener(
		"load",
		() => {
			if (
				!isPostResponse(this.responseURL) ||
				this.status < 200 ||
				this.status >= 300
			)
				return;
			try {
				if (this.responseType === "json") observe(this.response);
				else if (
					(!this.responseType || this.responseType === "text") &&
					this.responseText.length <= 5_000_000
				)
					observe(JSON.parse(this.responseText));
			} catch {
				/* Unrelated/binary responses are ignored. */
			}
		},
		{ once: true },
	);
	return sendOriginal.apply(this, args);
};
window.addEventListener("message", (event) => {
	if (event.source !== window || event.origin !== window.location.origin)
		return;
	const data: unknown = event.data;
	if (
		data &&
		typeof data === "object" &&
		"channel" in data &&
		data.channel === `${channel}-request`
	)
		publish([...cache.values()]);
	if (
		data &&
		typeof data === "object" &&
		"channel" in data &&
		data.channel === "solid-imager-xtracter-twitter-profile-request"
	)
		for (const profile of profiles.values())
			window.postMessage(
				{ channel: "solid-imager-xtracter-twitter-profile", profile },
				window.location.origin,
			);
});
