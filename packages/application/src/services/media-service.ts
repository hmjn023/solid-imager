import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type {
	Transaction,
	TransactionManager,
} from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
	type AddMediaRequest,
	type Media,
	type MediaDetails,
	type MediaGenerationInfo,
	type MediaSearchResponse,
	mediaIdSchema,
	mediaSearchRequestSchema,
	mediaSourceIdSchema,
	type UpdateMediaRequest,
	updateMediaRequestSchema,
} from "@solid-imager/core/domain/media/schemas";
import {
	type UploadMediaRequest,
	type UploadResponse,
	uploadMediaRequestSchema,
} from "@solid-imager/core/domain/media/upload-schemas";
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { TagRepository } from "@solid-imager/core/domain/repositories/tag-repository";
import type { IImageProcessor } from "@solid-imager/core/domain/services/image-processor";
import type {
	IMediaStorage,
	MediaSourceFile,
} from "@solid-imager/core/interfaces/media-storage";
import type { ProcessMediaJobRepository } from "../ports/job-repository";
import { queueMediaProcessingJob } from "./media-processing-job";

const SIGNATURES: Record<string, number[]> = {
	png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
	jpg: [0xff, 0xd8, 0xff],
	jpeg: [0xff, 0xd8, 0xff],
	gif: [0x47, 0x49, 0x46, 0x38],
	webp: [0x52, 0x49, 0x46, 0x46],
	mp4: [0x66, 0x74, 0x79, 0x70],
	webm: [0x1a, 0x45, 0xdf, 0xa3],
	mp3: [0x49, 0x44, 0x33],
	wav: [0x52, 0x49, 0x46, 0x46],
};

const WEBP_SUBTYPE = [0x57, 0x45, 0x42, 0x50];
const FILE_HEADER_BYTES = 12;
const WEBP_OFFSET = 8;
const WEBP_END = 12;

export type DeferredJob = {
	mediaId?: string;
	sourcePath?: string;
	type: "processMedia" | "downloadImage";
	payload?: unknown;
};

export type DeferredJobs = {
	mediaSourceId: string;
	jobs: DeferredJob[];
};

export type DeferredEvent = {
	mediaSourceId: string;
	event: string;
	payload: unknown;
};

export type DeferredActions = {
	jobs: DeferredJobs[];
	sse: DeferredEvent[];
};

export type MediaPathAdapter = {
	extname(path: string): string;
	basename(path: string): string;
	join(basePath: string, relativePath: string): string;
	relative(basePath: string, fullPath: string): string;
};

export type MediaContextMetadataUpdater = (
	mediaId: string,
	context: {
		sourceUrls?: UpdateMediaRequest["sourceUrls"];
		authors?: UpdateMediaRequest["authors"];
		characters?: UpdateMediaRequest["characters"];
		ips?: UpdateMediaRequest["ips"];
	},
	tx?: Transaction,
) => Promise<void>;

export type MediaServiceDeps = {
	mediaRepository: IMediaRepository;
	sourceRepository: SourceRepository;
	storageService: IMediaStorage;
	tagRepository: TagRepository;
	imageProcessor: IImageProcessor;
	authorRepository: IAuthorRepository;
	projectRepository: IProjectRepository;
	characterRepository: CharacterRepository;
	ipRepository: IIpRepository;
	transactionManager: TransactionManager;
	jobRepository?: ProcessMediaJobRepository;
	contextMetadataUpdater: MediaContextMetadataUpdater;
	pathAdapter?: MediaPathAdapter;
	thumbnailCleaner?: (sourceId: string, mediaId: string) => Promise<void>;
	eventPublisher?: (event: DeferredEvent) => Promise<void> | void;
	afterMediaRegistered?: (input: {
		media: Media;
		mediaSourceId: string;
		sourcePath: string;
		filePath: string;
	}) => Promise<void>;
	logger?: {
		info?(data: unknown, message?: string): void;
		error?(data: unknown, message?: string): void;
	};
};

function splitPath(path: string): string[] {
	return path.split(/[\\/]+/).filter((segment) => segment.length > 0);
}

const defaultPathAdapter: MediaPathAdapter = {
	extname(path: string): string {
		const name = this.basename(path);
		const index = name.lastIndexOf(".");
		return index >= 0 ? name.slice(index) : "";
	},
	basename(path: string): string {
		const segments = splitPath(path);
		return segments[segments.length - 1] ?? path;
	},
	join(basePath: string, relativePath: string): string {
		if (/^(?:[A-Za-z]:[\\/]|\/)/.test(relativePath)) {
			return relativePath;
		}
		const separator = basePath.includes("\\") ? "\\" : "/";
		const base = basePath.replace(/[\\/]+$/, "");
		const relative = relativePath
			.replace(/^[\\/]+/, "")
			.replace(/[\\/]/g, separator);
		return `${base}${separator}${relative}`;
	},
	relative(basePath: string, fullPath: string): string {
		const baseSegments = splitPath(basePath);
		const fullSegments = splitPath(fullPath);
		let index = 0;
		while (
			index < baseSegments.length &&
			baseSegments[index] === fullSegments[index]
		) {
			index += 1;
		}
		return fullSegments.slice(index).join("/");
	},
};

function getMediaTypeFromFileName(
	fileName: string,
	pathAdapter: MediaPathAdapter,
) {
	const ext = pathAdapter.extname(fileName).toLowerCase();
	if ([".mp4", ".webm", ".mov", ".mkv", ".avi"].includes(ext)) {
		return "video";
	}
	if ([".mp3", ".wav", ".ogg", ".m4a"].includes(ext)) {
		return "audio";
	}
	return "image";
}

function getContentTypeFromFileName(
	fileName: string,
	pathAdapter: MediaPathAdapter,
): string {
	const ext = pathAdapter.extname(fileName).toLowerCase().replace(".", "");
	switch (ext) {
		case "jpg":
		case "jpeg":
			return "image/jpeg";
		case "png":
			return "image/png";
		case "gif":
			return "image/gif";
		case "webp":
			return "image/webp";
		case "mp4":
			return "video/mp4";
		case "webm":
			return "video/webm";
		case "mov":
			return "video/quicktime";
		case "mkv":
			return "video/x-matroska";
		case "avi":
			return "video/x-msvideo";
		case "mp3":
			return "audio/mpeg";
		case "wav":
			return "audio/wav";
		case "ogg":
			return "audio/ogg";
		case "m4a":
			return "audio/mp4";
		default:
			return "application/octet-stream";
	}
}

function normalizeGenerationInfo(info: MediaGenerationInfo) {
	return {
		...info,
		aiGenerated: info.aiGenerated ?? false,
		modelName: info.modelName ?? "",
		seed: info.seed ?? -1,
		cfgScale: info.cfgScale ?? 0,
		steps: info.steps ?? 0,
	};
}

async function readHeaderBytes(file: MediaSourceFile): Promise<Uint8Array> {
	const headerSource = file.slice ? file.slice(0, FILE_HEADER_BYTES) : file;
	const buffer = await headerSource.arrayBuffer();
	return new Uint8Array(buffer).slice(0, FILE_HEADER_BYTES);
}

export async function validateFileSignature(
	file: MediaSourceFile,
	filename: string,
	pathAdapter: MediaPathAdapter = defaultPathAdapter,
): Promise<void> {
	const ext = pathAdapter.extname(filename).toLowerCase().replace(".", "");
	const bytes = await readHeaderBytes(file);
	const signature = SIGNATURES[ext];

	if (signature) {
		const matches = signature.every((byte, index) => bytes[index] === byte);
		if (!matches) {
			throw new Error(`File signature mismatch for .${ext}`);
		}
	}

	if (
		ext === "webp" &&
		!bytes
			.slice(WEBP_OFFSET, WEBP_END)
			.every((byte, index) => byte === WEBP_SUBTYPE[index])
	) {
		throw new Error("Invalid WEBP signature (missing WEBP)");
	}
}

export class MediaServiceImpl {
	private readonly mediaRepository: IMediaRepository;
	private readonly sourceRepository: SourceRepository;
	private readonly storageService: IMediaStorage;
	private readonly tagRepository: TagRepository;
	private readonly imageProcessor: IImageProcessor;
	private readonly authorRepository: IAuthorRepository;
	private readonly projectRepository: IProjectRepository;
	private readonly characterRepository: CharacterRepository;
	private readonly ipRepository: IIpRepository;
	private readonly transactionManager: TransactionManager;
	private readonly contextMetadataUpdater: MediaContextMetadataUpdater;
	private readonly pathAdapter: MediaPathAdapter;
	private readonly jobRepository: ProcessMediaJobRepository | undefined;
	private readonly thumbnailCleaner:
		| ((sourceId: string, mediaId: string) => Promise<void>)
		| undefined;
	private readonly eventPublisher:
		| ((event: DeferredEvent) => Promise<void> | void)
		| undefined;
	private readonly afterMediaRegistered:
		| MediaServiceDeps["afterMediaRegistered"]
		| undefined;
	private readonly logger: MediaServiceDeps["logger"];

	constructor(deps: MediaServiceDeps) {
		this.mediaRepository = deps.mediaRepository;
		this.sourceRepository = deps.sourceRepository;
		this.storageService = deps.storageService;
		this.tagRepository = deps.tagRepository;
		this.imageProcessor = deps.imageProcessor;
		this.authorRepository = deps.authorRepository;
		this.projectRepository = deps.projectRepository;
		this.characterRepository = deps.characterRepository;
		this.ipRepository = deps.ipRepository;
		this.transactionManager = deps.transactionManager;
		this.contextMetadataUpdater = deps.contextMetadataUpdater;
		this.pathAdapter = deps.pathAdapter ?? defaultPathAdapter;
		this.jobRepository = deps.jobRepository;
		this.thumbnailCleaner = deps.thumbnailCleaner;
		this.eventPublisher = deps.eventPublisher;
		this.afterMediaRegistered = deps.afterMediaRegistered;
		this.logger = deps.logger;
	}

	startProcessing(_mediaSourceId: string) {}

	async searchMedia(
		mediaSourceId: string | undefined | null,
		params: unknown,
	): Promise<MediaSearchResponse> {
		const searchRequest = mediaSearchRequestSchema.parse(params);
		if (mediaSourceId) {
			const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
			return await this.mediaRepository.search(
				validatedSourceId,
				searchRequest,
			);
		}
		return await this.mediaRepository.globalSearch(searchRequest);
	}

	async searchMediaInDirectory(
		mediaSourceId: string,
		directoryPath: string,
		params: { query?: string; tags?: string[] },
	): Promise<Media[]> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		return await this.mediaRepository.searchInDirectory(
			validatedSourceId,
			directoryPath,
			params,
		);
	}

	async uploadMedia(
		mediaSourceId: string,
		file: MediaSourceFile,
		options: UploadMediaRequest,
	): Promise<UploadResponse> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const mediaSource = await this.sourceRepository.findById(validatedSourceId);
		if (!mediaSource) {
			throw new ResourceNotFoundError("Media Source", validatedSourceId);
		}
		if (mediaSource.type !== "local") {
			throw new Error(
				"Only local media sources are supported for uploads in Phase 1.",
			);
		}

		const connectionInfo = mediaSource.connectionInfo as { path: string };
		const basePath = connectionInfo.path;
		const uploadRequest = uploadMediaRequestSchema.parse(options);
		await validateFileSignature(
			file,
			uploadRequest.filename ?? file.name,
			this.pathAdapter,
		);

		const fileInfo = await this.storageService.saveFile(basePath, file, {
			filename: uploadRequest.filename,
			overwrite: uploadRequest.overwrite,
			autoIncrement: uploadRequest.autoIncrement,
		});

		const mediaType = getMediaTypeFromFileName(
			fileInfo.fileName,
			this.pathAdapter,
		);
		const newMedia: AddMediaRequest = {
			mediaSourceId: validatedSourceId,
			filePath: fileInfo.filePath,
			fileName: fileInfo.fileName,
			mediaType,
			description: uploadRequest.description || null,
			width: fileInfo.width,
			height: fileInfo.height,
			fileSize: fileInfo.size,
			createdAt: fileInfo.createdAt,
			modifiedAt: fileInfo.modifiedAt,
		};

		let insertedMedia: Media;
		try {
			insertedMedia = await this.mediaRepository.upsert(newMedia);
		} catch (error) {
			try {
				await this.storageService.deleteFile(basePath, fileInfo.filePath);
			} catch (_deleteError) {
				// Best-effort rollback.
			}
			throw error;
		}

		try {
			if (uploadRequest.sourceUrl) {
				await this.mediaRepository.addUrls(insertedMedia.id, [
					uploadRequest.sourceUrl,
				]);
			}

			await this.afterMediaRegistered?.({
				media: insertedMedia,
				mediaSourceId: validatedSourceId,
				sourcePath: basePath,
				filePath: fileInfo.filePath,
			});
			await this.queueProcessingJob(
				insertedMedia.id,
				validatedSourceId,
				basePath,
			);
		} catch (error) {
			await this.rollbackPersistedUpload(
				insertedMedia.id,
				basePath,
				fileInfo.filePath,
			);
			throw error;
		}

		this.startProcessing(validatedSourceId);

		return {
			success: true,
			filePath: fileInfo.filePath,
			conflict: fileInfo.conflict,
		};
	}

	async getMediaDetails(
		mediaSourceId: string,
		mediaId: string,
	): Promise<MediaDetails> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);
		const mediaDetails =
			await this.mediaRepository.getDetails(validatedMediaId);
		if (!mediaDetails) {
			throw new ResourceNotFoundError("Media", validatedMediaId);
		}
		if (mediaDetails.mediaSourceId !== validatedSourceId) {
			throw new ResourceNotFoundError("Media not found in source");
		}

		let finalGenerationInfo = mediaDetails.generationInfo;
		if (!finalGenerationInfo) {
			finalGenerationInfo = await this.extractAndUpdateMetadata(
				mediaDetails,
				validatedSourceId,
			);
		}

		return {
			...mediaDetails,
			generationInfo: finalGenerationInfo
				? normalizeGenerationInfo(finalGenerationInfo)
				: null,
		};
	}

	async getMediaContent(
		mediaSourceId: string,
		mediaId: string,
	): Promise<{ buffer: Uint8Array; contentType: string }> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);
		const mediaSource = await this.sourceRepository.findById(validatedSourceId);
		if (!mediaSource) {
			throw new ResourceNotFoundError("Media Source", validatedSourceId);
		}
		const media = await this.getMedia(validatedSourceId, validatedMediaId);
		if (mediaSource.type !== "local") {
			throw new Error("Only local media sources is supported.");
		}
		const connectionInfo = mediaSource.connectionInfo as { path: string };
		const buffer = await this.storageService.getFile(
			connectionInfo.path,
			media.filePath,
		);
		const contentType = getContentTypeFromFileName(
			media.fileName,
			this.pathAdapter,
		);
		return { buffer, contentType };
	}

	async registerExistingMedia(
		mediaSourceId: string,
		directoryPath: string,
	): Promise<void> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const files = await this.storageService.scanDirectory(directoryPath);
		const newMediaItems: { id: string; filePath: string }[] = [];

		for (const file of files) {
			try {
				const relativePath = this.pathAdapter.relative(directoryPath, file);
				const existing = await this.mediaRepository.findByPath(
					validatedSourceId,
					relativePath,
				);
				if (existing) {
					continue;
				}

				try {
					const metadata = await this.storageService.getFileMetadata(file);
					const mediaType = getMediaTypeFromFileName(file, this.pathAdapter);
					const newMedia: AddMediaRequest = {
						mediaSourceId: validatedSourceId,
						filePath: relativePath,
						fileName: this.pathAdapter.basename(file),
						mediaType,
						width: metadata.width,
						height: metadata.height,
						fileSize: metadata.size,
						createdAt: metadata.createdAt,
						modifiedAt: metadata.modifiedAt,
						description: null,
					};
					const created = await this.mediaRepository.upsert(newMedia);
					newMediaItems.push({ id: created.id, filePath: relativePath });
				} catch (_error) {
					// Keep scan best-effort, matching the original server behavior.
				}
			} catch (_error) {
				// Keep scan best-effort, matching the original server behavior.
			}
		}

		for (const item of newMediaItems) {
			await this.queueProcessingJob(item.id, validatedSourceId, directoryPath);
		}
	}

	async getAllMedia(mediaSourceId: string): Promise<Media[]> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		return await this.mediaRepository.findAllBySourceId(validatedSourceId);
	}

	async getMedia(mediaSourceId: string, mediaId: string): Promise<Media> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);
		const media = await this.mediaRepository.findById(validatedMediaId);
		if (!media) {
			throw new ResourceNotFoundError("Media", validatedMediaId);
		}
		if (media.mediaSourceId !== validatedSourceId) {
			throw new ResourceNotFoundError("Media not found in source");
		}
		return media;
	}

	async updateMedia(
		mediaSourceId: string,
		mediaId: string,
		updates: unknown,
		tx?: Transaction,
	): Promise<Media> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);
		const parsedUpdates = updateMediaRequestSchema.parse(updates);

		const execute = async (transaction: Transaction) => {
			const media = await this.mediaRepository.findById(
				validatedMediaId,
				transaction,
			);
			if (!media || media.mediaSourceId !== validatedSourceId) {
				throw new ResourceNotFoundError("Media", validatedMediaId);
			}

			const [updatedMedia] = await Promise.all([
				this.mediaRepository.update(
					validatedMediaId,
					parsedUpdates,
					transaction,
				),
				this.contextMetadataUpdater(
					validatedMediaId,
					{
						sourceUrls: parsedUpdates.sourceUrls,
						authors: parsedUpdates.authors,
						characters: parsedUpdates.characters,
						ips: parsedUpdates.ips,
					},
					transaction,
				),
			]);
			return updatedMedia;
		};

		if (tx) {
			return await execute(tx);
		}
		return await this.transactionManager.transaction(execute);
	}

	async reprocessMetadata(
		mediaSourceId: string,
		mediaId: string,
	): Promise<MediaGenerationInfo | null> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);
		const media = await this.mediaRepository.findById(validatedMediaId);
		if (!media || media.mediaSourceId !== validatedSourceId) {
			throw new ResourceNotFoundError("Media", validatedMediaId);
		}
		return await this.extractAndUpdateMetadata(media, validatedSourceId);
	}

	async getMediaTags(mediaSourceId: string, mediaId: string) {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);
		await this.getMedia(validatedSourceId, validatedMediaId);
		return await this.mediaRepository.getTags(validatedMediaId);
	}

	async getMediaMetadata(
		mediaSourceId: string,
		mediaId: string,
	): Promise<MediaGenerationInfo | null> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);
		await this.getMedia(validatedSourceId, validatedMediaId);
		const generationInfo =
			await this.mediaRepository.getGenerationInfo(validatedMediaId);
		return generationInfo ? normalizeGenerationInfo(generationInfo) : null;
	}

	async copyMedia(
		sourceMediaId: string,
		targetSourceId: string,
		tx?: Transaction,
	): Promise<{ success: boolean; media: Media; deferred?: DeferredActions }> {
		const validatedSourceMediaId = mediaIdSchema.parse(sourceMediaId);
		const validatedTargetSourceId = mediaSourceIdSchema.parse(targetSourceId);
		const sourceMedia = await this.mediaRepository.findById(
			validatedSourceMediaId,
			tx,
		);
		if (!sourceMedia) {
			throw new ResourceNotFoundError("Source Media", validatedSourceMediaId);
		}

		const sourceSource = await this.sourceRepository.findById(
			sourceMedia.mediaSourceId,
			tx,
		);
		const targetSource = await this.sourceRepository.findById(
			validatedTargetSourceId,
			tx,
		);
		if (!(sourceSource && targetSource)) {
			throw new Error("Source or target media source not found.");
		}
		if (sourceSource.type !== "local" || targetSource.type !== "local") {
			throw new Error("Only local-to-local copy is supported in this version.");
		}

		const sourceConnection = sourceSource.connectionInfo as { path: string };
		const targetConnection = targetSource.connectionInfo as { path: string };
		const fullSourcePath = this.pathAdapter.join(
			sourceConnection.path,
			sourceMedia.filePath,
		);
		const fileInfo = await this.storageService.copyFile(
			fullSourcePath,
			targetConnection.path,
			{
				filename: sourceMedia.fileName,
				autoIncrement: true,
			},
		);

		const newMediaEntry = await this.mediaRepository.create(
			{
				mediaSourceId: validatedTargetSourceId,
				filePath: fileInfo.filePath,
				fileName: fileInfo.fileName,
				mediaType: sourceMedia.mediaType,
				width: fileInfo.width,
				height: fileInfo.height,
				fileSize: fileInfo.size,
				description: sourceMedia.description,
				createdAt: sourceMedia.createdAt,
				modifiedAt: sourceMedia.modifiedAt,
			},
			tx,
		);

		await this.copyMediaMetadata(validatedSourceMediaId, newMediaEntry.id, tx);

		const deferredActions: DeferredActions = {
			jobs: [
				{
					mediaSourceId: validatedTargetSourceId,
					jobs: [
						{
							mediaId: newMediaEntry.id,
							sourcePath: targetConnection.path,
							type: "processMedia",
							payload: {
								mediaId: newMediaEntry.id,
								sourcePath: targetConnection.path,
								type: "processMedia",
							},
						},
					],
				},
			],
			sse: [
				{
					mediaSourceId: validatedTargetSourceId,
					event: "media-copied",
					payload: {
						sourceMediaId,
						media: newMediaEntry,
						timestamp: new Date().toISOString(),
					},
				},
			],
		};

		if (tx) {
			return {
				success: true,
				media: newMediaEntry,
				deferred: deferredActions,
			};
		}

		await this.executeDeferredActions(deferredActions);
		return {
			success: true,
			media: newMediaEntry,
		};
	}

	async moveMedia(
		sourceMediaId: string,
		targetSourceId: string,
		tx?: Transaction,
	): Promise<{ success: boolean; media: Media; deferred?: DeferredActions }> {
		const execute = async (transaction: Transaction) => {
			const accumulatedDeferred: DeferredActions = {
				jobs: [],
				sse: [],
			};
			const copyResult = await this.copyMedia(
				sourceMediaId,
				targetSourceId,
				transaction,
			);
			if (copyResult.deferred) {
				accumulatedDeferred.jobs.push(...copyResult.deferred.jobs);
			}
			if (copyResult.success) {
				const sourceMedia = await this.mediaRepository.findById(
					sourceMediaId,
					transaction,
				);
				if (sourceMedia) {
					const deleteResult = await this.deleteMedia(
						sourceMedia.mediaSourceId,
						sourceMediaId,
						transaction,
					);
					if (deleteResult) {
						accumulatedDeferred.jobs.push(...deleteResult.jobs);
					}
					accumulatedDeferred.sse.push(
						{
							mediaSourceId: sourceMedia.mediaSourceId,
							event: "media-moved",
							payload: {
								type: "source",
								mediaId: sourceMediaId,
								targetId: targetSourceId,
								timestamp: new Date().toISOString(),
							},
						},
						{
							mediaSourceId: targetSourceId,
							event: "media-moved",
							payload: {
								type: "target",
								media: copyResult.media,
								sourceId: sourceMedia.mediaSourceId,
								timestamp: new Date().toISOString(),
							},
						},
					);
				}
			}
			return {
				...copyResult,
				deferred: accumulatedDeferred,
			};
		};

		if (tx) {
			return await execute(tx);
		}

		const result = await this.transactionManager.transaction(execute);
		if (result.deferred) {
			await this.executeDeferredActions(result.deferred);
		}
		return result;
	}

	async deleteMedia(
		mediaSourceId: string,
		mediaId: string,
		tx?: Transaction,
	): Promise<DeferredActions | undefined> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);
		const media = await this.mediaRepository.findById(validatedMediaId, tx);
		if (!media) {
			throw new ResourceNotFoundError("Media", validatedMediaId);
		}
		if (media.mediaSourceId !== validatedSourceId) {
			throw new Error("Media not in specified source");
		}

		await this.thumbnailCleaner?.(validatedSourceId, validatedMediaId);
		await this.mediaRepository.delete(validatedMediaId, tx);

		const mediaSource = await this.sourceRepository.findById(
			media.mediaSourceId,
			tx,
		);
		if (mediaSource?.type === "local") {
			const connectionInfo = mediaSource.connectionInfo as { path: string };
			try {
				await this.storageService.deleteFile(
					connectionInfo.path,
					media.filePath,
				);
			} catch (_error) {
				// File deletion is best-effort after DB deletion, matching old behavior.
			}
		}

		const event: DeferredEvent = {
			mediaSourceId: validatedSourceId,
			event: "media-deleted",
			payload: {
				filePath: media.filePath,
				timestamp: new Date().toISOString(),
			},
		};
		if (tx) {
			return { jobs: [], sse: [event] };
		}
		await this.eventPublisher?.(event);
		return undefined;
	}

	private async rollbackPersistedUpload(
		mediaId: string,
		basePath: string,
		filePath: string,
	): Promise<void> {
		try {
			await this.mediaRepository.delete(mediaId);
		} catch (error) {
			this.logger?.error?.(
				{ err: error, mediaId },
				"[MediaService] rollback media delete failed",
			);
		}

		try {
			await this.storageService.deleteFile(basePath, filePath);
		} catch (error) {
			this.logger?.error?.(
				{ err: error, filePath },
				"[MediaService] rollback file delete failed",
			);
		}
	}

	private async queueProcessingJob(
		mediaId: string,
		mediaSourceId: string,
		sourcePath: string,
	): Promise<void> {
		if (!this.jobRepository) {
			return;
		}
		await queueMediaProcessingJob({
			jobRepo: this.jobRepository,
			mediaId,
			mediaSourceId,
			sourcePath,
		});
	}

	private async executeDeferredActions(
		actions: DeferredActions,
	): Promise<void> {
		for (const item of actions.jobs) {
			for (const job of item.jobs) {
				if (job.type === "processMedia" && job.mediaId && job.sourcePath) {
					await this.queueProcessingJob(
						job.mediaId,
						item.mediaSourceId,
						job.sourcePath,
					);
				}
			}
		}
		for (const event of actions.sse) {
			await this.eventPublisher?.(event);
		}
	}

	private async copyMediaMetadata(
		sourceMediaId: string,
		newMediaId: string,
		tx?: Transaction,
	): Promise<void> {
		const sourceAuthors = await this.mediaRepository.getAuthors(
			sourceMediaId,
			tx,
		);
		if (sourceAuthors.length > 0) {
			await this.authorRepository.addMediaBulk(
				newMediaId,
				sourceAuthors.map((author) => author.id),
				tx,
			);
		}

		const sourceProjects = await this.projectRepository.findByMediaId(
			sourceMediaId,
			tx,
		);
		if (sourceProjects.length > 0) {
			await this.projectRepository.addMediaBulk(
				newMediaId,
				sourceProjects.map((project) => project.id),
				tx,
			);
		}

		const sourceCharacters = await this.characterRepository.findByMediaId(
			sourceMediaId,
			tx,
		);
		if (sourceCharacters.length > 0) {
			await this.characterRepository.addToMediaBulk(
				newMediaId,
				sourceCharacters.map((character) => ({ id: character.id })),
				"manual",
				tx,
			);
		}

		const sourceIps = await this.ipRepository.findByMediaId(sourceMediaId, tx);
		if (sourceIps.length > 0) {
			await this.ipRepository.addMediaBulk(
				newMediaId,
				sourceIps.map((ip) => ({ id: ip.id })),
				"manual",
				tx,
			);
		}

		const sourceUrls = await this.mediaRepository.getUrls(sourceMediaId, tx);
		if (sourceUrls.length > 0) {
			await this.mediaRepository.addUrls(
				newMediaId,
				sourceUrls.map((url) => url.url),
				tx,
			);
		}
	}

	private async extractAndUpdateMetadata(
		media: Media,
		sourceId: string,
	): Promise<MediaGenerationInfo | null> {
		const mediaSource = await this.sourceRepository.findById(sourceId);
		if (!mediaSource || mediaSource.type !== "local") {
			return null;
		}
		const connectionInfo = mediaSource.connectionInfo as { path: string };
		const fullPath = this.pathAdapter.join(connectionInfo.path, media.filePath);

		try {
			const metadata = await this.imageProcessor.extractMetadata(fullPath);
			this.logger?.info?.(
				{
					mediaId: media.id,
					fullPath,
					tagsCount: metadata.tags.length,
					hasWorkflow: !!metadata.workflow,
					hasPrompt: !!metadata.prompt,
				},
				"[MediaService] extractAndUpdateMetadata result",
			);
			await this.mediaRepository.upsertGenerationInfo(
				media.id,
				typeof metadata.prompt === "object"
					? JSON.stringify(metadata.prompt)
					: (metadata.prompt as string | null),
				metadata.workflow as object | null,
			);
			if (metadata.tags.length > 0) {
				await this.tagRepository.addTagsToMedia(
					media.id,
					metadata.tags,
					"comfyui_workflow",
				);
			}
			return await this.mediaRepository.getGenerationInfo(media.id);
		} catch (error) {
			this.logger?.error?.(
				{ err: error, mediaId: media.id, fullPath },
				"[MediaService] extractAndUpdateMetadata FAILED",
			);
			return null;
		}
	}
}

export function createMediaService(deps: MediaServiceDeps) {
	return new MediaServiceImpl(deps);
}

export type MediaService = ReturnType<typeof createMediaService>;
