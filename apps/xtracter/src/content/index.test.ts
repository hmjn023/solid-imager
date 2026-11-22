import type { DownloadItem } from "@ext/schema";
import { afterEach, describe, expect, it, vi } from "vitest";

const providers = vi.hoisted(() => ({
	pixiv: vi.fn<() => Promise<DownloadItem[]>>(),
	danbooru: vi.fn<() => Promise<DownloadItem[]>>(),
}));

vi.mock("./pixiv", () => ({
	getPixivPageMetadata: providers.pixiv,
	processPixivMedia: vi.fn(),
}));
vi.mock("./danbooru", () => ({
	getDanbooruPageMetadata: providers.danbooru,
	processDanbooruMedia: vi.fn(),
}));
vi.mock("../i18n", () => ({
	initializeExtensionLocale: vi.fn(async () => {}),
	t: vi.fn(),
}));

describe("Xtracter popup messaging", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetAllMocks();
		vi.resetModules();
	});

	it.each([
		["www.pixiv.net", providers.pixiv],
		["danbooru.donmai.us", providers.danbooru],
	] as const)(
		"keeps the popup response channel open for %s",
		async (hostname, provider) => {
			const addListener =
				vi.fn<
					(
						listener: (
							message: unknown,
							sender: object,
							sendResponse: (items: DownloadItem[]) => void,
						) => boolean | undefined,
					) => void
				>();
			vi.stubGlobal("chrome", { runtime: { onMessage: { addListener } } });
			vi.stubGlobal("window", { location: { hostname } });
			vi.stubGlobal("document", { body: {}, addEventListener: vi.fn() });
			vi.stubGlobal(
				"MutationObserver",
				class {
					observe() {}
				},
			);

			const items = [{ targetUrl: `https://${hostname}/original.png` }];
			const sendResponse = vi.fn();
			provider.mockResolvedValue(items);

			await import("./index");
			const listener = addListener.mock.calls[0][0];
			expect(listener({ type: "GET_METADATA" }, {}, sendResponse)).toBe(true);
			expect(sendResponse).not.toHaveBeenCalled();
			await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(items));
			expect(provider).toHaveBeenCalledOnce();
		},
	);
});
