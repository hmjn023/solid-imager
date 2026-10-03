type BrowserFetchInput = Parameters<typeof globalThis.fetch>[0];
type BrowserFetchInit = Parameters<typeof globalThis.fetch>[1];

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
	return globalThis.fetch(request.url, {
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
