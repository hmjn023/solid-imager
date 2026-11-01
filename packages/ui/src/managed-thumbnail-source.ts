import type { ThumbnailSource } from "./thumbnail-image";

/** Each rendered thumbnail owns its resolved URL, including late responses. */
export function createManagedThumbnailSource(
	url: string | Promise<string>,
	releaseUrl?: (url: string) => void,
): { source: ThumbnailSource; dispose: () => void } {
	let disposed = false;
	let resolvedUrl: string | undefined;
	const retain = (value: string) => {
		if (disposed) {
			releaseUrl?.(value);
			return "";
		}
		resolvedUrl = value;
		return value;
	};
	const ready = typeof url === "string" ? retain(url) : url.then(retain);
	return {
		source: { getUrl: () => ready },
		dispose: () => {
			if (disposed) return;
			disposed = true;
			if (resolvedUrl !== undefined) releaseUrl?.(resolvedUrl);
		},
	};
}
