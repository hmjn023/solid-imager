import {
	createMediaService,
	type IMediaService,
} from "@solid-imager/application/media";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { deleteThumbnail } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";
import { services } from "~/infrastructure/service-registry";
import { executeDeferredActions } from "~/infrastructure/services/job-dispatch-service";

// Defer construction until the service registry is initialized.
let mediaService: IMediaService | undefined;

export const resetMediaService = () => {
	mediaService = undefined;
};

function getMediaService(): IMediaService {
	return (mediaService ??= createMediaService({
		mediaRepository: services.getMediaRepository(),
		sourceRepository: services.getSourceRepository(),
		tagRepository: services.getTagRepository(),
		jobRepository: services.getJobRepository(),
		authorRepository: services.getAuthorRepository(),
		projectRepository: services.getProjectRepository(),
		characterRepository: services.getCharacterRepository(),
		ipRepository: services.getIpRepository(),
		storage: services.getMediaStorage(),
		imageProcessor: services.getImageProcessor(),
		transactionManager: DrizzleTransactionManager,
		eventPublisher: RealtimeEventBus,
		thumbnailManager: { deleteThumbnail },
		logger,
		deferredActionExecutor: { execute: executeDeferredActions },
		mediaContextProcessor: {
			addContextMetadataToExistingMedia(mediaId, context, tx) {
				return services
					.getMediaProcessingService()
					.addContextMetadataToExistingMedia(mediaId, context, tx);
			},
		},
	}));
}

export const MediaService = new Proxy({} as IMediaService, {
	get(_target, prop) {
		const service = getMediaService();
		const value = service[prop as keyof IMediaService];
		return typeof value === "function" ? value.bind(service) : value;
	},
});
