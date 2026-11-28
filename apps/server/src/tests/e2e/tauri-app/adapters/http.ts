type BrowserFetchInput = Parameters<typeof globalThis.fetch>[0];
type BrowserFetchInit = Parameters<typeof globalThis.fetch>[1];

// Each desktop window owns its HTTP client. Give its streams a separate
// Chromium connection pool so two fixture tabs cannot starve the Vite proxy.
const eventOrigin = new URL(window.location.origin);
eventOrigin.hostname = `tauri-${crypto.randomUUID()}.localhost`;

/**
 * Browser substitute for the native Tauri HTTP plugin.
 *
 * The native plugin materializes Request bodies before sending them over IPC.
 * Keep that boundary in the fixture so production-only upload regressions do
 * not disappear behind Chromium's ReadableStream request handling.
 */
export async function fetch(
	input: BrowserFetchInput,
	init?: BrowserFetchInit,
): Promise<Response> {
	const request = new Request(input, init);
	const body = request.body ? await request.arrayBuffer() : undefined;
	// Native HTTP can reach a separate server without browser CORS. Forward that
	// server's calls through the fixture proxy when emulating the plugin in Chromium.
	const url = new URL(request.url);
	const usesServerProxy = url.origin === import.meta.env.VITE_API_URL;
	const fixtureRequest =
		usesServerProxy || url.origin === window.location.origin;
	const requestPath = url.pathname + url.search;
	const isEventStream =
		url.pathname.startsWith("/api/") && url.pathname.endsWith("/events");
	const target =
		fixtureRequest && isEventStream
			? new URL(requestPath, eventOrigin)
			: usesServerProxy
				? requestPath
				: request.url;
	return globalThis.fetch(target, {
		body,
		cache: request.cache,
		credentials: request.credentials,
		headers: request.headers,
		integrity: request.integrity,
		keepalive: request.keepalive,
		method: request.method,
		redirect: request.redirect,
		referrer: request.referrer,
		referrerPolicy: request.referrerPolicy,
		signal: request.signal,
	});
}
