import type { Media } from "@solid-imager/core/domain/media/schemas";
import { createRoot } from "solid-js";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vite-plus/test";
import {
	createHttpThumbnailSource,
	createLocalThumbnailSource,
	type ObjectUrlAdapter,
} from "./thumbnail-source";

const media: Media = {
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	description: null,
	fileName: "image.png",
	filePath: "nested/image.png",
	fileSize: 1024,
	height: 100,
	id: "11111111-1111-4111-8111-111111111111",
	indexedAt: new Date("2026-01-01T00:00:00.000Z"),
	mediaSourceId: "22222222-2222-4222-8222-222222222222",
	mediaType: "image",
	modifiedAt: new Date("2026-02-03T04:05:06.000Z"),
	status: "active",
	width: 100,
};

const flushPromises = () =>
	new Promise<void>((resolve) => queueMicrotask(resolve));

function createObjectUrlAdapter(): ObjectUrlAdapter & {
	readonly created: string[];
	readonly revoked: string[];
} {
	const created: string[] = [];
	const revoked: string[] = [];

	return {
		created,
		create(_bytes, mimeType) {
			const url = `blob:${mimeType}:${created.length + 1}`;
			created.push(url);
			return url;
		},
		revoke(url) {
			revoked.push(url);
		},
		revoked,
	};
}

describe("createHttpThumbnailSource", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("builds the URL with the modifiedAt cache key", () => {
		let dispose = () => {};
		const source = createRoot((rootDispose) => {
			dispose = rootDispose;
			return createHttpThumbnailSource({
				buildUrl: ({ cacheKey, mediaId, mediaSourceId }) =>
					`/api/sources/${mediaSourceId}/${mediaId}/thumbnail?t=${cacheKey}`,
				mediaId: media.id,
				mediaSourceId: media.mediaSourceId,
				modifiedAt: media.modifiedAt,
			});
		});

		expect(source.getUrl()).toBe(
			`/api/sources/${media.mediaSourceId}/${media.id}/thumbnail?t=${media.modifiedAt.getTime()}`,
		);

		dispose();
	});

	it("updates the cache key after an error retry delay", () => {
		let dispose = () => {};
		const source = createRoot((rootDispose) => {
			dispose = rootDispose;
			return createHttpThumbnailSource({
				buildUrl: ({ cacheKey }) => `/thumbnail?t=${cacheKey}`,
				mediaId: media.id,
				mediaSourceId: media.mediaSourceId,
				modifiedAt: media.modifiedAt,
				retryDelayMs: 100,
			});
		});

		source.onError?.();
		vi.setSystemTime(new Date("2026-03-01T00:00:01.000Z"));
		vi.advanceTimersByTime(100);

		expect(source.getUrl()).toBe("/thumbnail?t=1772323201100");

		dispose();
	});

	it("stops scheduling retries after maxRetries is reached", () => {
		let dispose = () => {};
		const source = createRoot((rootDispose) => {
			dispose = rootDispose;
			return createHttpThumbnailSource({
				buildUrl: ({ cacheKey }) => `/thumbnail?t=${cacheKey}`,
				maxRetries: 1,
				mediaId: media.id,
				mediaSourceId: media.mediaSourceId,
				modifiedAt: media.modifiedAt,
				retryDelayMs: 100,
			});
		});

		source.onError?.();
		vi.setSystemTime(new Date("2026-03-01T00:00:01.000Z"));
		vi.advanceTimersByTime(100);
		expect(source.getUrl()).toBe("/thumbnail?t=1772323201100");

		source.onError?.();
		vi.setSystemTime(new Date("2026-03-01T00:00:02.000Z"));
		vi.advanceTimersByTime(100);
		expect(source.getUrl()).toBe("/thumbnail?t=1772323201100");

		dispose();
	});
});

describe("createLocalThumbnailSource", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("prefers the thumbnail resource URL", async () => {
		let dispose = () => {};
		const source = createRoot((rootDispose) => {
			dispose = rootDispose;
			return createLocalThumbnailSource({
				getThumbnailResource: vi.fn().mockResolvedValue({
					filePath: "/thumb/source/media.webp",
					url: "asset://thumb.webp?t=1",
				}),
				joinPath: (rootPath, filePath) => `${rootPath}/${filePath}`,
				media,
				objectUrl: createObjectUrlAdapter(),
				readFile: vi.fn(),
				subscribeToThumbnailReady: () => () => {},
			});
		});

		await flushPromises();

		expect(await source.getUrl()).toBe("asset://thumb.webp?t=1");

		dispose();
	});

	it("falls back to reading the thumbnail file when the resource URL fails", async () => {
		let dispose = () => {};
		const objectUrl = createObjectUrlAdapter();
		const readFile = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
		const source = createRoot((rootDispose) => {
			dispose = rootDispose;
			return createLocalThumbnailSource({
				getThumbnailResource: vi.fn().mockResolvedValue({
					filePath: "/thumb/source/media.webp",
					url: "asset://thumb.webp?t=1",
				}),
				joinPath: (rootPath, filePath) => `${rootPath}/${filePath}`,
				media,
				objectUrl,
				readFile,
				subscribeToThumbnailReady: () => () => {},
			});
		});

		await flushPromises();
		await Promise.resolve(source.onError?.());

		expect(readFile).toHaveBeenCalledWith("/thumb/source/media.webp");
		expect(await source.getUrl()).toBe("blob:image/webp:1");

		source.onLoad?.();
		expect(objectUrl.revoked).toEqual(["blob:image/webp:1"]);

		dispose();
	});

	it("falls back to the original file and keeps retrying for a thumbnail", async () => {
		let dispose = () => {};
		const objectUrl = createObjectUrlAdapter();
		const getThumbnailResource = vi
			.fn()
			.mockRejectedValue(new Error("not ready"));
		const readFile = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
		const source = createRoot((rootDispose) => {
			dispose = rootDispose;
			return createLocalThumbnailSource({
				getThumbnailResource,
				joinPath: (rootPath, filePath) => `${rootPath}/${filePath}`,
				media,
				objectUrl,
				readFile,
				retryDelayMs: 100,
				sourceRootPath: "/source-root",
				subscribeToThumbnailReady: () => () => {},
			});
		});

		await flushPromises();
		await Promise.resolve(source.onError?.());

		expect(readFile).toHaveBeenCalledWith("/source-root/nested/image.png");
		expect(await source.getUrl()).toBe("blob:image/png:1");

		vi.advanceTimersByTime(100);
		await flushPromises();
		expect(getThumbnailResource).toHaveBeenCalledTimes(2);

		dispose();
	});

	it("re-fetches the thumbnail resource when thumbnail ready is published", async () => {
		let dispose = () => {};
		let listener: (() => void) | undefined;
		const callback = vi.fn();
		const getThumbnailResource = vi
			.fn()
			.mockResolvedValueOnce({
				filePath: "/thumb/source/media.webp",
				url: "asset://thumb.webp?t=1",
			})
			.mockResolvedValueOnce({
				filePath: "/thumb/source/media.webp",
				url: "asset://thumb.webp?t=2",
			});
		const source = createRoot((rootDispose) => {
			dispose = rootDispose;
			return createLocalThumbnailSource({
				getThumbnailResource,
				joinPath: (rootPath, filePath) => `${rootPath}/${filePath}`,
				media,
				objectUrl: createObjectUrlAdapter(),
				readFile: vi.fn(),
				subscribeToThumbnailReady: (_mediaId, readyCallback) => {
					listener = readyCallback;
					return () => {
						listener = undefined;
					};
				},
			});
		});

		await flushPromises();
		const unsubscribe = source.subscribe?.(callback);
		listener?.();
		await flushPromises();

		expect(callback).toHaveBeenCalledOnce();
		expect(await source.getUrl()).toBe("asset://thumb.webp?t=2");

		unsubscribe?.();
		dispose();
	});

	it("ignores stale thumbnail resource responses", async () => {
		let dispose = () => {};
		let listener: (() => void) | undefined;
		let resolveFirst:
			| ((resource: { filePath: string; url: string }) => void)
			| undefined;
		const getThumbnailResource = vi
			.fn()
			.mockImplementationOnce(
				() =>
					new Promise<{ filePath: string; url: string }>((resolve) => {
						resolveFirst = resolve;
					}),
			)
			.mockResolvedValueOnce({
				filePath: "/thumb/source/media-new.webp",
				url: "asset://thumb-new.webp?t=2",
			});
		const source = createRoot((rootDispose) => {
			dispose = rootDispose;
			return createLocalThumbnailSource({
				getThumbnailResource,
				joinPath: (rootPath, filePath) => `${rootPath}/${filePath}`,
				media,
				objectUrl: createObjectUrlAdapter(),
				readFile: vi.fn(),
				subscribeToThumbnailReady: (_mediaId, readyCallback) => {
					listener = readyCallback;
					return () => {};
				},
			});
		});

		source.subscribe?.(vi.fn());
		listener?.();
		await flushPromises();
		expect(await source.getUrl()).toBe("asset://thumb-new.webp?t=2");

		resolveFirst?.({
			filePath: "/thumb/source/media-old.webp",
			url: "asset://thumb-old.webp?t=1",
		});
		await flushPromises();

		expect(await source.getUrl()).toBe("asset://thumb-new.webp?t=2");

		dispose();
	});

	it("does not revoke the same fallback object URL twice during cleanup", async () => {
		let dispose = () => {};
		const objectUrl = createObjectUrlAdapter();
		const source = createRoot((rootDispose) => {
			dispose = rootDispose;
			return createLocalThumbnailSource({
				getThumbnailResource: vi.fn().mockResolvedValue({
					filePath: "/thumb/source/media.webp",
					url: "asset://thumb.webp?t=1",
				}),
				joinPath: (rootPath, filePath) => `${rootPath}/${filePath}`,
				media,
				objectUrl,
				readFile: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
				subscribeToThumbnailReady: () => () => {},
			});
		});

		await flushPromises();
		await Promise.resolve(source.onError?.());
		dispose();

		expect(objectUrl.revoked).toEqual(["blob:image/webp:1"]);
	});
});
