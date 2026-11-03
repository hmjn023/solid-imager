import type { ILogger } from "./ports/logger";
import type {
	IMediaStorage,
	TransactionManager,
	IImageProcessor,
} from "@solid-imager/core/ports";
import type { IAuthorRepository } from "@solid-imager/core/authors";
import type { CharacterRepository } from "@solid-imager/core/characters";
import type { IIpRepository } from "@solid-imager/core/ips";
import type { IJobRepository } from "@solid-imager/core/jobs";
import type { IProjectRepository } from "@solid-imager/core/projects";
import type { SourceRepository } from "@solid-imager/core/sources";
import type { TagRepository } from "@solid-imager/core/tags";
import type {
	IDeferredActionExecutor,
	IMediaContextProcessor,
	IMediaService,
	ISourceEventPublisher,
	IThumbnailManager,
} from "./ports/media-service";
import {
	MediaQueryService,
	type MediaQueryRepository,
} from "./services/media-query-service";
import { MediaServiceImpl } from "./services/media-service";
import {
	MediaTransferService,
	type MediaTransferRepository,
} from "./services/media-transfer-service";
import {
	MediaUploadService,
	type MediaUploadRepository,
} from "./services/media-upload-service";

export type { DeferredActions, IMediaService } from "./ports/media-service";

export interface MediaServiceDeps {
	mediaRepository: MediaQueryRepository &
		MediaUploadRepository &
		MediaTransferRepository;
	sourceRepository: SourceRepository;
	tagRepository: TagRepository;
	jobRepository: IJobRepository;
	authorRepository: IAuthorRepository;
	projectRepository: IProjectRepository;
	characterRepository: CharacterRepository;
	ipRepository: IIpRepository;
	storage: IMediaStorage;
	imageProcessor: IImageProcessor;
	transactionManager: TransactionManager;
	eventPublisher: ISourceEventPublisher;
	thumbnailManager: IThumbnailManager;
	logger: ILogger;
	deferredActionExecutor: IDeferredActionExecutor;
	mediaContextProcessor: IMediaContextProcessor;
}

export function createMediaService(deps: MediaServiceDeps): IMediaService {
	const query = new MediaQueryService(
		deps.mediaRepository,
		deps.sourceRepository,
		deps.storage,
		deps.tagRepository,
		deps.imageProcessor,
		deps.logger,
	);
	const upload = new MediaUploadService(
		deps.mediaRepository,
		deps.sourceRepository,
		deps.storage,
		deps.jobRepository,
	);
	const transfer = new MediaTransferService(
		deps.mediaRepository,
		deps.sourceRepository,
		deps.storage,
		deps.authorRepository,
		deps.projectRepository,
		deps.characterRepository,
		deps.ipRepository,
		deps.transactionManager,
		deps.jobRepository,
		deps.eventPublisher,
		deps.thumbnailManager,
		deps.logger,
		deps.deferredActionExecutor,
		deps.mediaContextProcessor,
	);
	return new MediaServiceImpl(query, upload, transfer);
}
