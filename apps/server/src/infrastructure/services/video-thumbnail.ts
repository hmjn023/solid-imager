import { stat } from "node:fs/promises";
import type { ResolveVideoThumbnail } from "@solid-imager/application/tagging";
import {
	generateThumbnailForMedia,
	getThumbnailPath,
	THUMBNAIL_SIZE_LARGE,
} from "~/infrastructure/jobs/thumbnails";

const inFlight = new Map<string, Promise<string>>();

/** Reuses the display thumbnail; AI jobs can also run before thumbnail generation finishes. */
export const resolveVideoThumbnail: ResolveVideoThumbnail = async (media) => {
	const key = `${media.mediaSourceId}:${media.id}:${media.modifiedAt.getTime()}`;
	const existing = inFlight.get(key);
	if (existing) return existing;

	const resolve = async () => {
		const thumbnailPath = getThumbnailPath(
			media.mediaSourceId,
			media.id,
			THUMBNAIL_SIZE_LARGE,
		);
		try {
			const cached = await stat(thumbnailPath);
			if (
				cached.size > 0 &&
				cached.mtime.getTime() === media.modifiedAt.getTime()
			) {
				return thumbnailPath;
			}
		} catch (error) {
			if (
				!(error instanceof Error && "code" in error && error.code === "ENOENT")
			) {
				throw error;
			}
		}
		await generateThumbnailForMedia(
			media.mediaSourceId,
			media.id,
			THUMBNAIL_SIZE_LARGE,
		);
		return thumbnailPath;
	};
	const pending = resolve().finally(() => inFlight.delete(key));
	inFlight.set(key, pending);
	return pending;
};
