import { getContentTypeFromExtension } from "@solid-imager/core/media/files";
import { localConnectionSchema } from "@solid-imager/core/sources";
import type { ThumbnailSize } from "@solid-imager/core/thumbnails";
import {
	getThumbnailPath,
	queueThumbnailGeneration,
	THUMBNAIL_SIZE_LARGE,
	THUMBNAIL_SIZE_SMALL,
} from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";
import { services } from "~/infrastructure/service-registry";
import { resolveSafePath } from "~/infrastructure/storage/server-media-storage";

export async function readOriginalMediaFile(sourceId: string, mediaId: string) {
	const media = await services.getMediaRepository().findById(mediaId);
	if (!media || media.mediaSourceId !== sourceId) {
		return { error: "NOT_FOUND", message: "Media not found" } as const;
	}
	const source = await services.getSourceRepository().findById(sourceId);
	if (source?.type !== "local") {
		return { error: "BAD_REQUEST", message: "Invalid media source" } as const;
	}
	const connection = localConnectionSchema.parse(source.connectionInfo);
	const file = Bun.file(resolveSafePath(connection.path, media.filePath));
	if (!(await file.exists())) {
		return { error: "NOT_FOUND", message: "File not found on disk" } as const;
	}
	return { file, contentType: getContentTypeFromExtension(media.fileName) };
}

export async function readMediaThumbnail(
	sourceId: string,
	mediaId: string,
	size: ThumbnailSize = THUMBNAIL_SIZE_LARGE,
	cacheKey?: string,
) {
	const file = Bun.file(getThumbnailPath(sourceId, mediaId, size));
	if (await file.exists()) {
		return {
			status: 200,
			headers: {
				"cache-control":
					cacheKey === undefined
						? "private, max-age=300"
						: "private, max-age=31536000, immutable",
				"content-type": "image/webp",
			},
			body: file.stream(),
		} as const;
	}

	void queueThumbnailGeneration(sourceId, mediaId, size).catch((error) =>
		logger.error(
			{ err: error, mediaId, mediaSourceId: sourceId, size },
			"Failed to queue on-demand thumbnail generation",
		),
	);
	if (size === THUMBNAIL_SIZE_SMALL) {
		const fallback = Bun.file(
			getThumbnailPath(sourceId, mediaId, THUMBNAIL_SIZE_LARGE),
		);
		if (await fallback.exists()) {
			return {
				status: 200,
				headers: {
					"cache-control": "private, max-age=30",
					"content-type": "image/webp",
					"x-thumbnail-fallback": "512",
				},
				body: fallback.stream(),
			} as const;
		}
	}

	// The client retries this transient state while the generation job runs.
	return { status: 204, headers: { "cache-control": "no-store" } } as const;
}
