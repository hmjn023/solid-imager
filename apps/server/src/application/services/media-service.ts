/**
 * MediaService - Server-side wiring.
 * Thin wrapper that delegates to the extracted MediaServiceImpl in @solid-imager/application.
 */

import type { IMediaStorage } from "@solid-imager/core";
import type { TransactionManager } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { TagRepository as TagRepositoryDef } from "@solid-imager/core/domain/repositories/tag-repository";
import type { IImageProcessor } from "@solid-imager/core/domain/services/image-processor";
import {
	MediaServiceImpl,
	validateFileSignature,
} from "@solid-imager/application/services/media-service";
import type {
	DeferredActions,
	IDeferredActionExecutor,
	ILogger,
	IMediaContextProcessor,
	ISseNotifier,
	IThumbnailManager,
} from "@solid-imager/application/ports/media-service";
import { services } from "~/application/registry";
import { executeDeferredActions } from "~/application/services/job-dispatch-service";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { deleteThumbnail } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";

// Re-export for backward compatibility
export { validateFileSignature };
export { MediaServiceImpl };

// Infrastructure adapters that wrap server-specific implementations
const sseNotifier: ISseNotifier = {
	sendEvent(mediaSourceId, eventType, data) {
		SseManager.sendEvent(mediaSourceId, eventType, data);
	},
	notifyMediaCopied(sourceId, targetId, media) {
		SseManager.notifyMediaCopied(sourceId, targetId, media);
	},
};

const thumbnailManager: IThumbnailManager = {
	deleteThumbnail(mediaSourceId, mediaId) {
		return deleteThumbnail(mediaSourceId, mediaId);
	},
};

const appLogger: ILogger = {
	info(obj, msg) {
		logger.info(obj, msg);
	},
	error(obj, msg) {
		logger.error(obj, msg);
	},
	warn(obj, msg) {
		logger.warn(obj, msg);
	},
};

const deferredActionExecutor: IDeferredActionExecutor = {
	async execute(actions: DeferredActions) {
		await executeDeferredActions(actions);
	},
};

// For backward compatibility and deferred initialization
let _mediaService: MediaServiceImpl | null = null;

export const resetMediaService = () => {
	_mediaService = null;
};

function createMediaService(): MediaServiceImpl {
	const mediaContextProcessor: IMediaContextProcessor = {
		addContextMetadataToExistingMedia(mediaId, context, tx) {
			return services
				.getMediaProcessingService()
				.addContextMetadataToExistingMedia(mediaId, context, tx);
		},
	};

	return new MediaServiceImpl(
		services.getMediaRepository(),
		services.getSourceRepository(),
		services.getMediaStorage(),
		services.getTagRepository(),
		services.getImageProcessor(),
		services.getAuthorRepository(),
		services.getProjectRepository(),
		services.getCharacterRepository(),
		services.getIpRepository(),
		DrizzleTransactionManager as TransactionManager,
		services.getJobRepository(),
		sseNotifier,
		thumbnailManager,
		appLogger,
		mediaContextProcessor,
		deferredActionExecutor,
	);
}

const getMediaService = () => {
	if (!_mediaService) {
		_mediaService = createMediaService();
	}
	return _mediaService;
};

export const MediaService = new Proxy({} as MediaServiceImpl, {
	get(_target, prop) {
		const service = getMediaService();
		const value = service[prop as keyof MediaServiceImpl];
		return typeof value === "function" ? value.bind(service) : value;
	},
});
