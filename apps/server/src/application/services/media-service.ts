import path from "node:path";
import {
	type DeferredActions,
	type MediaContextMetadataUpdater,
	type MediaServiceDeps,
	MediaServiceImpl as SharedMediaServiceImpl,
	validateFileSignature,
} from "@solid-imager/application/services/media-service";
import type { IMediaStorage } from "@solid-imager/core";
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { TagRepository as TagRepositoryDef } from "@solid-imager/core/domain/repositories/tag-repository";
import type { IImageProcessor } from "@solid-imager/core/domain/services/image-processor";
import { services } from "~/application/registry";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { deleteThumbnail } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";
import type { MediaProcessingServiceImpl } from "./media-processing-service";

export type { DeferredActions };
export { validateFileSignature };

const serverPathAdapter: NonNullable<MediaServiceDeps["pathAdapter"]> = {
	extname: path.extname,
	basename: path.basename,
	join: path.join,
	relative: path.relative,
};

function createServerDeps(
	mediaRepository: IMediaRepository,
	sourceRepository: SourceRepository,
	storageService: IMediaStorage,
	tagRepository: TagRepositoryDef,
	imageProcessor: IImageProcessor,
	authorRepository: IAuthorRepository,
	projectRepository: IProjectRepository,
	characterRepository: CharacterRepository,
	ipRepository: IIpRepository,
	mediaProcessingService: MediaProcessingServiceImpl,
): MediaServiceDeps {
	const contextMetadataUpdater: MediaContextMetadataUpdater = async (
		mediaId,
		context,
		tx,
	) => {
		await mediaProcessingService.addContextMetadataToExistingMedia(
			mediaId,
			context,
			tx,
		);
	};

	return {
		mediaRepository,
		sourceRepository,
		storageService,
		tagRepository,
		imageProcessor,
		authorRepository,
		projectRepository,
		characterRepository,
		ipRepository,
		transactionManager: DrizzleTransactionManager,
		jobRepository: services.getJobRepository(),
		contextMetadataUpdater,
		pathAdapter: serverPathAdapter,
		thumbnailCleaner: deleteThumbnail,
		eventPublisher: (event) => {
			SseManager.sendEvent(event.mediaSourceId, event.event, event.payload);
		},
		logger,
	};
}

export class MediaServiceImpl extends SharedMediaServiceImpl {
	constructor(
		mediaRepository: IMediaRepository,
		sourceRepository: SourceRepository,
		storageService: IMediaStorage,
		tagRepository: TagRepositoryDef,
		imageProcessor: IImageProcessor,
		authorRepository: IAuthorRepository,
		projectRepository: IProjectRepository,
		characterRepository: CharacterRepository,
		ipRepository: IIpRepository,
		mediaProcessingService: MediaProcessingServiceImpl,
	) {
		super(
			createServerDeps(
				mediaRepository,
				sourceRepository,
				storageService,
				tagRepository,
				imageProcessor,
				authorRepository,
				projectRepository,
				characterRepository,
				ipRepository,
				mediaProcessingService,
			),
		);
	}
}

let mediaService: MediaServiceImpl | null = null;

export const resetMediaService = () => {
	mediaService = null;
};

const getMediaService = () => {
	if (!mediaService) {
		mediaService = new MediaServiceImpl(
			services.getMediaRepository(),
			services.getSourceRepository(),
			services.getMediaStorage(),
			services.getTagRepository(),
			services.getImageProcessor(),
			services.getAuthorRepository(),
			services.getProjectRepository(),
			services.getCharacterRepository(),
			services.getIpRepository(),
			services.getMediaProcessingService(),
		);
	}
	return mediaService;
};

export const MediaService = new Proxy({} as MediaServiceImpl, {
	get(_target, prop) {
		const service = getMediaService();
		const value = service[prop as keyof MediaServiceImpl];
		return typeof value === "function" ? value.bind(service) : value;
	},
});
