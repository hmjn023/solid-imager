import { createMediaDeletionEffects } from "@solid-imager/application/media";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { deleteThumbnail } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";
import { services } from "~/infrastructure/service-registry";

export const mediaDeletionEffects = createMediaDeletionEffects({
	storage: {
		deleteFile: (basePath, filePath) =>
			services.getMediaStorage().deleteFile(basePath, filePath),
	},
	thumbnails: { deleteThumbnail },
	events: RealtimeEventBus,
	logger,
});
