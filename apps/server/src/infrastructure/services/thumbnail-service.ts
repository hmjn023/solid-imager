import type { ThumbnailSize } from "@solid-imager/core/domain/thumbnails/schemas";
import {
	generateThumbnailsForSource,
	getSourceCacheDir,
} from "~/infrastructure/jobs/thumbnails";
import { services } from "~/infrastructure/service-registry";

export { ThumbnailServiceImpl } from "@solid-imager/application/services/thumbnail-service";

export const ThumbnailService = {
	getMediaThumbnailUrl(
		mediaSourceId: string,
		mediaId: string,
		size?: ThumbnailSize,
	): string {
		let url = `/api/sources/${mediaSourceId}/thumbnail/${mediaId}`;
		if (size) {
			url += `?size=${size}`;
		}
		return url;
	},

	async startThumbnailGeneration(
		mediaSourceId: string,
		options: { size: ThumbnailSize; missingOnly: boolean },
	) {
		const result = await generateThumbnailsForSource(mediaSourceId, options);
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

	async clearThumbnailCache(mediaSourceId: string) {
		const cacheDir = getSourceCacheDir(mediaSourceId);
		const fs = services.getFileSystem();
		try {
			await fs.rm(cacheDir, { recursive: true, force: true });
			return { success: true };
		} catch (error) {
			throw new Error(`Failed to clear thumbnail cache: ${error}`);
		}
	},
};
