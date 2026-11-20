import { UnreconciledStorageError } from "@solid-imager/core/errors";
import type { IMediaStorage } from "@solid-imager/core/ports";
import type { ILogger } from "../ports/logger";
import type {
	ISourceEventPublisher,
	IThumbnailManager,
	MediaDeletionPlan,
} from "../ports/media-service";

interface MediaDeletionEffectDeps {
	storage: Pick<IMediaStorage, "deleteFile">;
	thumbnails: IThumbnailManager;
	events: Pick<ISourceEventPublisher, "publishSource">;
	logger: ILogger;
}

export interface MediaDeletionEffects {
	execute(plan: MediaDeletionPlan): Promise<void>;
}

export function createMediaDeletionEffects({
	storage,
	thumbnails,
	events,
	logger,
}: MediaDeletionEffectDeps): MediaDeletionEffects {
	return {
		async execute({ kind, targets }) {
			const cleanupErrors: unknown[] = [];
			for (const { mediaSourceId, mediaId, filePath, basePath } of targets) {
				if (basePath !== undefined) {
					try {
						await storage.deleteFile(basePath, filePath);
					} catch (err) {
						cleanupErrors.push(err);
						logger.warn(
							{ err, mediaSourceId, mediaId, filePath },
							"Failed to delete committed media file",
						);
					}
				}
				try {
					await thumbnails.deleteThumbnail(mediaSourceId, mediaId);
				} catch (err) {
					cleanupErrors.push(err);
					logger.warn(
						{ err, mediaSourceId, mediaId },
						"Failed to delete committed media thumbnail",
					);
				}
				if (kind === "delete") {
					try {
						events.publishSource(mediaSourceId, "media-deleted", {
							mediaId,
							filePath,
							timestamp: new Date().toISOString(),
						});
					} catch (err) {
						logger.warn(
							{ err, mediaSourceId, mediaId },
							"Media deletion committed; observer notification failed",
						);
					}
				}
			}
			// A failed move cleanup can leave both source and destination files.
			if (kind === "move" && cleanupErrors.length) {
				throw new UnreconciledStorageError(cleanupErrors);
			}
		},
	};
}
