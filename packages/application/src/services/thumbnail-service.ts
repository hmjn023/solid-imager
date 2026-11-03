import type { ThumbnailSize } from "@solid-imager/core/thumbnails";
import type { IThumbnailService } from "../ports/thumbnail-service";

export type ThumbnailServiceDeps = {
	removeSourceCache: (mediaSourceId: string) => Promise<void>;
	generateThumbnailsForSource: (
		mediaSourceId: string,
		options: { size: ThumbnailSize; missingOnly: boolean },
	) => Promise<{ count: number; jobId?: string }>;
};

/** Builds thumbnail URLs, queues generation and clears a source cache directory. */
export function createThumbnailService(
	deps: ThumbnailServiceDeps,
): IThumbnailService {
	return {
		getMediaThumbnailUrl(mediaSourceId, mediaId, size) {
			let url = `/api/sources/${mediaSourceId}/thumbnail/${mediaId}`;
			if (size) {
				url += `?size=${size}`;
			}
			return url;
		},

		async startThumbnailGeneration(mediaSourceId, options) {
			const result = await deps.generateThumbnailsForSource(
				mediaSourceId,
				options,
			);
			return {
				success: true,
				count: result.count,
				jobId: result.jobId,
				message:
					result.count > 0
						? `Queued ${result.count} thumbnail job(s)`
						: "No thumbnails need generation",
			};
		},

		async clearThumbnailCache(mediaSourceId) {
			try {
				await deps.removeSourceCache(mediaSourceId);
				return { success: true };
			} catch (error) {
				throw new Error(
					`Failed to clear thumbnail cache: ${error instanceof Error ? error.message : String(error)}`,
					{ cause: error },
				);
			}
		},
	};
}
