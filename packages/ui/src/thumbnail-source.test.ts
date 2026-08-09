import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import {
	type BuildThumbnailUrlArgs,
	createHttpThumbnailSource,
} from "./thumbnail-source";

function buildUrl(args: BuildThumbnailUrlArgs) {
	const query = new URLSearchParams();
	if (args.size) query.set("size", String(args.size));
	query.set("t", String(args.cacheKey));
	return `/thumbnail/${args.mediaId}?${query.toString()}`;
}

describe("createHttpThumbnailSource", () => {
	it("builds a 512px fallback and responsive 256/512 candidates", () => {
		createRoot((dispose) => {
			const modifiedAt = "2026-08-02T00:00:00.000Z";
			const cacheKey = new Date(modifiedAt).getTime();
			const source = createHttpThumbnailSource({
				buildUrl,
				defaultSize: 512,
				mediaId: "media-1",
				mediaSourceId: "source-1",
				modifiedAt,
				responsiveSizes: [256, 512],
			});

			expect(source.getUrl()).toContain("size=512");
			expect(source.getSrcSet?.()).toBe(
				`${buildUrl({ cacheKey, mediaId: "media-1", mediaSourceId: "source-1", size: 256 })} 256w, ${buildUrl({ cacheKey, mediaId: "media-1", mediaSourceId: "source-1", size: 512 })} 512w`,
			);
			dispose();
		});
	});

	it("keeps the legacy URL when no requested size is provided", () => {
		createRoot((dispose) => {
			const source = createHttpThumbnailSource({
				buildUrl,
				mediaId: "media-1",
				mediaSourceId: "source-1",
				modifiedAt: "2026-08-02T00:00:00.000Z",
			});

			expect(source.getUrl()).not.toContain("size=");
			expect(source.getSrcSet?.()).toBeUndefined();
			dispose();
		});
	});

	it("notifies active images when a failed thumbnail is retried", () => {
		vi.useFakeTimers();
		try {
			createRoot((dispose) => {
				const source = createHttpThumbnailSource({
					buildUrl,
					mediaId: "media-1",
					mediaSourceId: "source-1",
					modifiedAt: "2026-08-02T00:00:00.000Z",
					retryDelayMs: 100,
				});
				const listener = vi.fn();
				const unsubscribe = source.subscribe?.(listener);

				source.onError?.();
				vi.advanceTimersByTime(99);
				expect(listener).not.toHaveBeenCalled();
				vi.advanceTimersByTime(1);
				expect(listener).toHaveBeenCalledOnce();

				unsubscribe?.();
				dispose();
			});
		} finally {
			vi.useRealTimers();
		}
	});
});
