/**
 * MediaService - Server-side wiring.
 * Thin wrapper that delegates to the extracted MediaServiceImpl in @solid-imager/application.
 */

import type {
	DeferredActions,
	IDeferredActionExecutor,
	ILogger,
	IMediaContextProcessor,
	ISourceEventPublisher,
	IThumbnailManager,
} from "@solid-imager/application/ports/media-service";
import { MediaQueryService } from "@solid-imager/application/services/media-query-service";
import {
	MediaServiceImpl,
	validateFileSignature,
} from "@solid-imager/application/services/media-service";
import { MediaTransferService } from "@solid-imager/application/services/media-transfer-service";
import { MediaUploadService } from "@solid-imager/application/services/media-upload-service";
import type { TransactionManager } from "@solid-imager/core/domain/interfaces/transaction-manager";
import { services } from "~/application/registry";
import { executeDeferredActions } from "~/application/services/job-dispatch-service";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { deleteThumbnail } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";

// Re-export for backward compatibility
export { MediaServiceImpl, validateFileSignature };

// Infrastructure adapters that wrap server-specific implementations
const eventPublisher: ISourceEventPublisher = {
	publishSource(mediaSourceId, eventType, data) {
		RealtimeEventBus.publishSource(mediaSourceId, eventType, data);
	},
	notifyMediaCopied(sourceId, targetId, media) {
		RealtimeEventBus.notifyMediaCopied(sourceId, targetId, media);
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

	const queryService = new MediaQueryService(
		services.getMediaRepository(),
		services.getSourceRepository(),
		services.getMediaStorage(),
		services.getTagRepository(),
		services.getImageProcessor(),
		appLogger,
	);

	const uploadService = new MediaUploadService(
		services.getMediaRepository(),
		services.getSourceRepository(),
		services.getMediaStorage(),
		services.getJobRepository(),
	);

	const transferService = new MediaTransferService(
		services.getMediaRepository(),
		services.getSourceRepository(),
		services.getMediaStorage(),
		services.getAuthorRepository(),
		services.getProjectRepository(),
		services.getCharacterRepository(),
		services.getIpRepository(),
		DrizzleTransactionManager as TransactionManager,
		services.getJobRepository(),
		eventPublisher,
		thumbnailManager,
		appLogger,
		deferredActionExecutor,
		mediaContextProcessor,
	);

	return new MediaServiceImpl(queryService, uploadService, transferService);
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
