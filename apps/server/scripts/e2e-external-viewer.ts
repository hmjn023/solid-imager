import { externalViewerFixturePath } from "../src/tests/e2e/support/fixture";

const nativeFetch = globalThis.fetch;
const viewerFixturePath = externalViewerFixturePath();
const testFetch: typeof fetch = Object.assign(
	async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
		const url = new URL(input instanceof Request ? input.url : input);
		if (
			url.hostname === "danbooru.donmai.us" ||
			url.hostname === "www.pixiv.net"
		) {
			const viewerFixture = Bun.file(viewerFixturePath);
			const responses = (await viewerFixture.exists())
				? ((await viewerFixture.json()) as Record<string, unknown>)
				: {};
			return Object.hasOwn(responses, url.pathname)
				? Response.json(responses[url.pathname], {
						headers: { "Cache-Control": "no-store" },
					})
				: new Response(null, { status: 404 });
		}
		return nativeFetch(input, init);
	},
	nativeFetch,
);
globalThis.fetch = testFetch;
