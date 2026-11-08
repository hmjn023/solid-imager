import { createThumbnailService } from "@solid-imager/application/thumbnails";
import {
	generateThumbnailsForSource,
	getSourceCacheDir,
} from "~/infrastructure/jobs/thumbnails";
import { services } from "~/infrastructure/service-registry";

export const ThumbnailService = createThumbnailService({
	generateThumbnailsForSource,
	removeSourceCache: (sourceId) =>
		services
			.getFileSystem()
			.rm(getSourceCacheDir(sourceId), { recursive: true, force: true }),
});
