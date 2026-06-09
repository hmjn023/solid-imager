import { services } from "~/application/registry";
import {
	generateThumbnailsForSource,
	getSourceCacheDir,
} from "~/infrastructure/jobs/thumbnails";

export { ThumbnailServiceImpl } from "@solid-imager/application/services/thumbnail-service";

export const ThumbnailService = {
	getMediaThumbnailUrl(
		mediaSourceId: string,
		mediaId: string,
		size?: number,
	): string {
		let url = `/api/sources/${mediaSourceId}/thumbnail/${mediaId}`;
		if (size) {
			url += `?size=${size}`;
		}
		return url;
	},

	async startThumbnailGeneration(mediaSourceId: string) {
		const count = await generateThumbnailsForSource(mediaSourceId);
		return { success: true, count };
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
