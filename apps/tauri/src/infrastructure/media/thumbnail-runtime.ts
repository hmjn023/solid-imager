import { mediaContentPath, mediaThumbnailPath } from "@solid-imager/core/http";
import { buildAbsoluteUrl } from "~/infrastructure/tauri-fetch-helpers";

/** Returns the remote thumbnail endpoint for a media item. */
export function getThumbnailResource(
	mediaSourceId: string,
	mediaId: string,
): string {
	return buildAbsoluteUrl(mediaThumbnailPath(mediaSourceId, mediaId));
}

/** Builds a thumbnail URL with optional size and cache-busting timestamp. */
export function buildThumbnailUrl(args: {
	cacheKey: number;
	mediaId: string;
	mediaSourceId: string;
	size?: 256 | 512;
}): string {
	return buildAbsoluteUrl(
		mediaThumbnailPath(args.mediaSourceId, args.mediaId, args),
	);
}

/** Returns the remote content URL for a media item. */
export function buildMediaContentUrl(
	mediaSourceId: string,
	mediaId: string,
): string {
	return buildAbsoluteUrl(mediaContentPath(mediaSourceId, mediaId));
}

/** Remote server mode does not require a local thumbnail-ready notification. */
export function notifyThumbnailReady(_mediaId: string) {
	// No-op for remote server mode
}
