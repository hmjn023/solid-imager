/**
 * MediaService - Core business logic for media management.
 * Extracted from apps/server to packages/application.
 * Infrastructure dependencies are injected via constructor.
 */

import path from "node:path";
import type { IMediaStorage } from "@solid-imager/core";
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
	updateMediaRequestSchema,
} from "@solid-imager/core/domain/media/schemas";
import {
	type UploadMediaRequest,
	type UploadResponse,
	uploadMediaRequestSchema,
} from "@solid-imager/core/domain/media/upload-schemas";
import {
	getContentTypeFromExtension,
	getMediaTypeFromExtension,
} from "@solid-imager/core/domain/media/utils/media-type-utils";
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { TagRepository } from "@solid-imager/core/domain/repositories/tag-repository";
import type { IImageProcessor } from "@solid-imager/core/domain/services/image-processor";
import type {
	DeferredActions,
	DeferredSse,
	IDeferredActionExecutor,
	ILogger,
	IMediaContextProcessor,
	IMediaService,
	ISseNotifier,
	IThumbnailManager,
} from "../ports/media-service";

const SIGNATURES: Record<string, Buffer> = {
	png: Buffer.from("89504e470d0a1a0a", "hex"),
	jpg: Buffer.from("ffd8ff", "hex"),
	jpeg: Buffer.from("ffd8ff", "hex"),
	gif: Buffer.from("47494638", "hex"),
	webp: Buffer.from("52494646", "hex"), // RIFF
	mp4: Buffer.from("66747970", "hex"), // ftyp
	webm: Buffer.from("1a45dfa3", "hex"),
	mp3: Buffer.from("494433", "hex"), // ID3
	wav: Buffer.from("52494646", "hex"), // RIFF
};

const WEBP_SUBTYPE = Buffer.from("57454250", "hex"); // WEBP
const FILE_HEADER_BYTES = 12;
const WEBP_OFFSET = 8;
const WEBP_END = 12;

export async function validateFileSignature(
	file: File,
	filename: string,
): Promise<void> {
	const ext = path.extname(filename).toLowerCase().replace(".", "");
	const buffer = await file.slice(0, FILE_HEADER_BYTES).arrayBuffer();
	const bytes = new Uint8Array(buffer);

	// Basic checks
	if (ext in SIGNATURES) {
		const sig = SIGNATURES[ext];
		// Check start signature
		if (sig && !bytes.subarray(0, sig.length).every((b, i) => b === sig[i])) {
			throw new Error(`File signature mismatch for .${ext}`);
		}
	}

	// Extra check for WEBP: RIFF....WEBP
	if (
		ext === "webp" &&
		!bytes
			.subarray(WEBP_OFFSET, WEBP_END)
			.every((b, i) => b === WEBP_SUBTYPE[i])
	) {
		throw new Error("Invalid WEBP signature (missing WEBP)");
	}
}

export class MediaServiceImpl implements IMediaService {
	private readonly mediaRepository: any;
	private readonly sourceRepository: any;
	private readonly storageService: any;
	private readonly tagRepository: any;
	private readonly imageProcessor: any;
	private readonly authorRepository: any;
	private readonly projectRepository: any;
	private readonly characterRepository: any;
	private readonly ipRepository: any;
	private readonly transactionManager: TransactionManager;
	private readonly jobRepo: { create(job: { type: string; mediaSourceId: string; payload: unknown }): Promise<unknown> };
	private readonly sseNotifier: ISseNotifier;
	private readonly thumbnailManager: IThumbnailManager;
	private readonly logger: ILogger;
	private readonly mediaContextProcessor: IMediaContextProcessor;
	private readonly deferredActionExecutor: IDeferredActionExecutor;

	constructor(
		mediaRepository: IMediaRepository,
		sourceRepository: SourceRepository,
		storageService: IMediaStorage,
		tagRepository: TagRepository,
		imageProcessor: IImageProcessor,
		authorRepository: IAuthorRepository,
		projectRepository: IProjectRepository,
		characterRepository: CharacterRepository,
		ipRepository: IIpRepository,
		transactionManager: TransactionManager,
		jobRepo: { create(job: { type: string; mediaSourceId: string; payload: unknown }): Promise<unknown> },
		sseNotifier: ISseNotifier,
		thumbnailManager: IThumbnailManager,
		logger: ILogger,
		mediaContextProcessor: IMediaContextProcessor,
		deferredActionExecutor: IDeferredActionExecutor,
	) {
		this.mediaRepository = mediaRepository;
		this.sourceRepository = sourceRepository;
		this.storageService = storageService;
		this.tagRepository = tagRepository;
		this.imageProcessor = imageProcessor;
		this.authorRepository = authorRepository;
		this.projectRepository = projectRepository;
		this.characterRepository = characterRepository;
		this.ipRepository = ipRepository;
		this.transactionManager = transactionManager;
		this.jobRepo = jobRepo;
		this.sseNotifier = sseNotifier;
		this.thumbnailManager = thumbnailManager;
		this.logger = logger;
		this.mediaContextProcessor = mediaContextProcessor;
		this.deferredActionExecutor = deferredActionExecutor;
	}

	/**
	 * Starts processing jobs for the given source using the unified processor.
	 * @deprecated Worker now handles this automatically.
	 */
	startProcessing(_mediaSourceId: string) {
		// No-op: JobWorker is handling this globally.
	}

	/**
	 * Searches for media.
	 */
	async searchMedia(
		mediaSourceId: string | undefined | null,
		params: unknown,
	): Promise<MediaSearchResponse> {
		const searchRequest = mediaSearchRequestSchema.parse(params);
		if (mediaSourceId) {
			const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
			return (await this.mediaRepository.search(
				validatedSourceId,
				searchRequest,
			)) as MediaSearchResponse;
		}
		return (await this.mediaRepository.globalSearch(
			searchRequest,
		)) as MediaSearchResponse;
	}

	/**
	 * Searches for media in a directory.
	 */
	async searchMediaInDirectory(
		mediaSourceId: string,
		directoryPath: string,
		params: { query?: string; tags?: string[] },
	): Promise<Media[]> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		return (await this.mediaRepository.searchInDirectory(
			validatedSourceId,
			directoryPath,
			params,
		)) as Media[];
	}

	/**
	 * Uploads a media file.
	 */
	async uploadMedia(
		mediaSourceId: string,
		file: File,
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

		// 0. Validate File Signature
		await validateFileSignature(file, uploadRequest.filename ?? file.name);

		// 1. Save File via StorageService
		const fileInfo = await this.storageService.saveFile(basePath, file, {
			filename: uploadRequest.filename,
			overwrite: uploadRequest.overwrite,
			autoIncrement: uploadRequest.autoIncrement,
		});

		// Determine media type based on extension
		const mediaType = getMediaTypeFromExtension(fileInfo.fileName);

		// 2. Create Media Entry
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
			insertedMedia = (await this.mediaRepository.upsert(newMedia)) as Media;
		} catch (error) {
			// 3. Rollback: Delete file if DB insertion fails
			try {
				await this.storageService.deleteFile(basePath, fileInfo.filePath);
			} catch (_deleteError) {
				// Ignore rollback error
			}
			throw error;
		}

		// Register URL if present (legacy support for sourceUrl in upload)
		if (uploadRequest.sourceUrl) {
			await this.mediaRepository.addUrls(insertedMedia.id, [
				uploadRequest.sourceUrl,
			]);
		}

		// 4. Trigger processMedia Job (unified processing)
		await this.jobRepo.create({
			type: "processMedia",
			mediaSourceId: validatedSourceId,
			payload: {
				mediaId: insertedMedia.id,
				sourcePath: basePath,
				type: "processMedia",
			},
		});

		this.startProcessing(validatedSourceId);

		return {
			success: true,
			filePath: fileInfo.filePath,
			conflict: fileInfo.conflict as { existingFile: string; suggestedName: string } | undefined,
		};
	}

	/**
	 * Retrieves media details including tags and generation info.
	 */
	async getMediaDetails(
		mediaSourceId: string,
		mediaId: string,
	): Promise<MediaDetails> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);

		const mediaDetails =
			(await this.mediaRepository.getDetails(validatedMediaId)) as MediaDetails | null;
		if (!mediaDetails) {
			throw new ResourceNotFoundError("Media", validatedMediaId);
		}
		if (mediaDetails.mediaSourceId !== validatedSourceId) {
			throw new ResourceNotFoundError("Media not found in source");
		}

		let finalGenerationInfo = mediaDetails.generationInfo;

		// If generation info is not found, try to extract it (Lazy Extraction)
		if (!finalGenerationInfo) {
			finalGenerationInfo = await this.extractAndUpdateMetadata(
				mediaDetails as Media,
				validatedSourceId,
			);
		}

		return {
			...mediaDetails,
			generationInfo: finalGenerationInfo
				? {
						...finalGenerationInfo,
						aiGenerated: finalGenerationInfo.aiGenerated ?? false,
						modelName: finalGenerationInfo.modelName ?? "",
						seed: finalGenerationInfo.seed ?? -1,
						cfgScale: finalGenerationInfo.cfgScale ?? 0,
						steps: finalGenerationInfo.steps ?? 0,
					}
				: null,
		} as MediaDetails;
	}

	/**
	 * Retrieves media content (file buffer) and content type.
	 */
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

		const media = (await this.mediaRepository.findById(
			validatedMediaId,
		)) as Media | null;
		if (!media) {
			throw new ResourceNotFoundError("Media", validatedMediaId);
		}
		if (media.mediaSourceId !== validatedSourceId) {
			throw new ResourceNotFoundError("Media not found in source");
		}

		if (mediaSource.type !== "local") {
			throw new Error("Only local media sources is supported.");
		}
		const connectionInfo = mediaSource.connectionInfo as { path: string };
		const buffer = await this.storageService.getFile(
			connectionInfo.path,
			media.filePath,
		);

		const contentType = getContentTypeFromExtension(media.fileName);

		return { buffer, contentType };
	}

	/**
	 * Registers existing media from a directory.
	 */
	async registerExistingMedia(mediaSourceId: string, directoryPath: string) {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const files = await this.storageService.scanDirectory(directoryPath);
		const newMediaItems: { id: string; filePath: string }[] = [];

		for (const file of files) {
			try {
				const relativePath = path.relative(directoryPath, file);
				const existing = await this.mediaRepository.findByPath(
					validatedSourceId,
					relativePath,
				);

				if (!existing) {
					try {
						const metadata = (await this.storageService.getFileMetadata(file)) as {
							width: number;
							height: number;
							size: number;
							createdAt: Date;
							modifiedAt: Date;
						};

						// Simple extension check for media type
						const mediaType = getMediaTypeFromExtension(file);

						const newMedia: AddMediaRequest = {
							mediaSourceId: validatedSourceId,
							filePath: relativePath,
							fileName: path.basename(file),
							mediaType,
							width: metadata.width,
							height: metadata.height,
							fileSize: metadata.size,
							createdAt: metadata.createdAt,
							modifiedAt: metadata.modifiedAt,
							description: null,
						};

						const created = (await this.mediaRepository.upsert(
							newMedia,
						)) as Media;
						newMediaItems.push({ id: created.id, filePath: relativePath });
					} catch (_e) {
						// Ignore creation errors
					}
				}
			} catch (_e) {
				// Ignore finding errors
			}
		}

		if (newMediaItems.length > 0) {
			// Use processMedia job type for unified processing
			for (const item of newMediaItems) {
				await this.jobRepo.create({
					type: "processMedia",
					mediaSourceId: validatedSourceId,
					payload: {
						mediaId: item.id,
						sourcePath: directoryPath,
						type: "processMedia",
					},
				});
			}
		}
	}

	/**
	 * Retrieves all media for a source.
	 */
	async getAllMedia(mediaSourceId: string): Promise<Media[]> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		return (await this.mediaRepository.findAllBySourceId(
			validatedSourceId,
		)) as Media[];
	}

	/**
	 * Retrieves a single media item.
	 */
	async getMedia(
		mediaSourceId: string,
		mediaId: string,
	): Promise<Media> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);
		const media = (await this.mediaRepository.findById(
			validatedMediaId,
		)) as Media | null;
		if (!media) {
			throw new ResourceNotFoundError("Media", validatedMediaId);
		}
		if (media.mediaSourceId !== validatedSourceId) {
			throw new ResourceNotFoundError("Media not found in source");
		}
		return media;
	}

	/**
	 * Updates a media item.
	 */
	async updateMedia(
		mediaSourceId: string,
		mediaId: string,
		updates: unknown,
		tx?: Transaction,
	): Promise<Media> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);
		const parsedUpdates = updateMediaRequestSchema.parse(updates);

		const execute = async (t: Transaction) => {
			const media = await this.mediaRepository.findById(validatedMediaId, t);
			if (!media || media.mediaSourceId !== validatedSourceId) {
				throw new ResourceNotFoundError("Media", validatedMediaId);
			}

			const [updatedMedia] = await Promise.all([
				this.mediaRepository.update(validatedMediaId, parsedUpdates, t),
				this.mediaContextProcessor.addContextMetadataToExistingMedia(
					validatedMediaId,
					{
						sourceUrls: parsedUpdates.sourceUrls,
						authors: parsedUpdates.authors,
						characters: parsedUpdates.characters,
						ips: parsedUpdates.ips,
					},
					t,
				),
			]);

			return updatedMedia as Media;
		};

		if (tx) {
			return await execute(tx);
		}
		return (await this.transactionManager.transaction(execute)) as Media;
	}

	/**
	 * Reprocesses media metadata (extracts generation info and tags).
	 */
	async reprocessMetadata(
		mediaSourceId: string,
		mediaId: string,
	): Promise<MediaGenerationInfo | null> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);

		const media = (await this.mediaRepository.findById(
			validatedMediaId,
		)) as Media | null;
		if (!media || media.mediaSourceId !== validatedSourceId) {
			throw new ResourceNotFoundError("Media", validatedMediaId);
		}

		return await this.extractAndUpdateMetadata(media, validatedSourceId);
	}

	/**
	 * Retrieves tags for a media item.
	 */
	async getMediaTags(mediaSourceId: string, mediaId: string) {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);

		const media = (await this.mediaRepository.findById(
			validatedMediaId,
		)) as Media | null;
		if (!media) {
			throw new ResourceNotFoundError("Media", validatedMediaId);
		}
		if (media.mediaSourceId !== validatedSourceId) {
			throw new ResourceNotFoundError("Media not found in source");
		}

		return await this.mediaRepository.getTags(validatedMediaId);
	}

	/**
	 * Retrieves metadata (generation info) for a media item.
	 */
	async getMediaMetadata(
		mediaSourceId: string,
		mediaId: string,
	): Promise<MediaGenerationInfo | null> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);

		const media = (await this.mediaRepository.findById(
			validatedMediaId,
		)) as Media | null;
		if (!media) {
			throw new ResourceNotFoundError("Media", validatedMediaId);
		}
		if (media.mediaSourceId !== validatedSourceId) {
			throw new ResourceNotFoundError("Media not found in source");
		}

		const generationInfo = (await this.mediaRepository.getGenerationInfo(
			validatedMediaId,
		)) as MediaGenerationInfo | null;
		return generationInfo
			? {
					...generationInfo,
					aiGenerated: generationInfo.aiGenerated ?? false,
					modelName: generationInfo.modelName ?? "",
					seed: generationInfo.seed ?? -1,
					cfgScale: generationInfo.cfgScale ?? 0,
					steps: generationInfo.steps ?? 0,
				}
			: null;
	}

	/**
	 * Copies a media item to another source.
	 */
	async copyMedia(
		sourceMediaId: string,
		targetSourceId: string,
		tx?: Transaction,
	): Promise<{ success: boolean; media: Media; deferred?: DeferredActions }> {
		const validatedSourceMediaId = mediaIdSchema.parse(sourceMediaId);
		const validatedTargetSourceId = mediaSourceIdSchema.parse(targetSourceId);

		// 1. Get Source Media and Source Info
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

		// 2. Validate Local-to-Local (Phase 1 Limitation)
		if (sourceSource.type !== "local" || targetSource.type !== "local") {
			throw new Error("Only local-to-local copy is supported in this version.");
		}

		const sourceConnection = sourceSource.connectionInfo as { path: string };
		const targetConnection = targetSource.connectionInfo as { path: string };
		const fullSourcePath = path.join(
			sourceConnection.path,
			sourceMedia.filePath,
		);

		// 3. Perform Physical Copy
		const fileInfo = await this.storageService.copyFile(
			fullSourcePath,
			targetConnection.path,
			{
				filename: sourceMedia.fileName,
				autoIncrement: true,
			},
		);

		// 4. Create New Media Entry in DB
		const newMedia: AddMediaRequest = {
			mediaSourceId: validatedTargetSourceId,
			filePath: fileInfo.filePath,
			fileName: fileInfo.fileName,
			mediaType: sourceMedia.mediaType,
			width: fileInfo.width,
			height: fileInfo.height,
			fileSize: fileInfo.size,
			description: sourceMedia.description,
			// Preserve original dates instead of using new file timestamps
			createdAt: sourceMedia.createdAt,
			modifiedAt: sourceMedia.modifiedAt,
		};

		const newMediaEntry = await this.mediaRepository.create(newMedia, tx);

		// 4. Copy Metadata
		await this._copyMediaMetadata(validatedSourceMediaId, newMediaEntry.id, tx);

		// 5. Prepare Deferred Actions (Jobs + Notifications)
		const sourcePath = targetConnection.path;
		// Construct DB Job DTO (DeferredJob)
		const deferredJob = {
			mediaId: newMediaEntry.id,
			sourcePath,
			type: "processMedia" as const,
			payload: {
				mediaId: newMediaEntry.id,
				sourcePath,
				type: "processMedia",
			},
		};

		const deferredActions: DeferredActions = {
			jobs: [
				{
					mediaSourceId: validatedTargetSourceId,
					jobs: [deferredJob],
				},
			],
			sse: [],
		};

		const sseEvent: DeferredSse = {
			mediaSourceId: validatedTargetSourceId,
			event: "media-copied",
			payload: {
				sourceMediaId,
				media: newMediaEntry,
				timestamp: new Date().toISOString(),
			},
		};

		if (tx) {
			deferredActions.sse.push(sseEvent);
			return {
				success: true,
				media: newMediaEntry,
				deferred: deferredActions,
			};
		}

		// Execute immediately if no transaction
		await this.jobRepo.create({
			type: "processMedia",
			mediaSourceId: validatedTargetSourceId,
			payload: {
				mediaId: newMediaEntry.id,
				sourcePath,
				type: "processMedia",
			},
		});

		this.sseNotifier.notifyMediaCopied(
			sourceMediaId,
			validatedTargetSourceId,
			newMediaEntry,
		);

		return {
			success: true,
			media: newMediaEntry,
		};
	}

	/**
	 * Moves a media item to another source (Copy + Delete).
	 */
	async moveMedia(
		sourceMediaId: string,
		targetSourceId: string,
		tx?: Transaction,
	): Promise<{ success: boolean; media: Media; deferred?: DeferredActions }> {
		const execute = async (t: Transaction) => {
			const accumulatedDeferred: DeferredActions = {
				jobs: [],
				sse: [],
			};

			// 1. Copy
			const copyResult = await this.copyMedia(sourceMediaId, targetSourceId, t);
			if (copyResult.deferred) {
				accumulatedDeferred.jobs.push(...copyResult.deferred.jobs);
				// We omit individual media-copied event for move context
			}

			// 2. Delete Original if Copy Successful
			if (copyResult.success) {
				const sourceMedia = await this.mediaRepository.findById(
					sourceMediaId,
					t,
				);
				if (sourceMedia) {
					const deleteResult = await this.deleteMedia(
						sourceMedia.mediaSourceId,
						sourceMediaId,
						t,
					);
					if (deleteResult) {
						accumulatedDeferred.jobs.push(...deleteResult.jobs);
						// We omit individual media-deleted event for move context
					}

					// Replicate SseManager.notifyMediaMoved logic but deferred
					const sseEventSource: DeferredSse = {
						mediaSourceId: sourceMedia.mediaSourceId,
						event: "media-moved",
						payload: {
							type: "source",
							mediaId: sourceMediaId,
							targetId: targetSourceId,
							timestamp: new Date().toISOString(),
						},
					};
					const sseEventTarget: DeferredSse = {
						mediaSourceId: targetSourceId,
						event: "media-moved",
						payload: {
							type: "target",
							media: copyResult.media,
							sourceId: sourceMedia.mediaSourceId,
							timestamp: new Date().toISOString(),
						},
					};
					accumulatedDeferred.sse.push(sseEventSource, sseEventTarget);
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

		// Top-level transaction
		const result = await this.transactionManager.transaction(execute);

		// Execute deferred actions after commit
		if (result.deferred) {
			await this.deferredActionExecutor.execute(result.deferred);
		}

		return result;
	}

	/**
	 * Deletes a media item.
	 */
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

		// 1. Delete thumbnail
		await this.thumbnailManager.deleteThumbnail(validatedSourceId, validatedMediaId);

		// 2. Delete from database
		await this.mediaRepository.delete(validatedMediaId, tx);

		// 3. Delete file from filesystem
		if (media.mediaSourceId) {
			const mediaSource = await this.sourceRepository.findById(
				media.mediaSourceId,
				tx,
			);
			if (mediaSource && mediaSource.type === "local") {
				const connectionInfo = mediaSource.connectionInfo as { path: string };
				try {
					await this.storageService.deleteFile(
						connectionInfo.path,
						media.filePath,
					);
				} catch (_e) {
					// Log error
				}
			}
		}

		// Prepare Deferred Notification
		const sseEvent: DeferredSse = {
			mediaSourceId: validatedSourceId,
			event: "media-deleted",
			payload: {
				filePath: media.filePath,
				timestamp: new Date().toISOString(),
			},
		};

		if (tx) {
			return {
				jobs: [],
				sse: [sseEvent],
			};
		}

		// Notify via SSE immediately
		this.sseNotifier.sendEvent(
			sseEvent.mediaSourceId,
			sseEvent.event,
			sseEvent.payload,
		);
	}

	/**
	 * Helper to copy metadata (Authors, Projects, Characters, IPs, URLs)
	 */
	private async _copyMediaMetadata(
		sourceMediaId: string,
		newMediaId: string,
		tx: Transaction,
	): Promise<void> {
		// 1. Authors
		const sourceAuthors = await this.mediaRepository.getAuthors(
			sourceMediaId,
			tx,
		);
		if (sourceAuthors.length > 0) {
			await this.authorRepository.addMediaBulk(
				newMediaId,
				sourceAuthors.map((a: { id: string }) => a.id),
				tx,
			);
		}

		// 2. Projects
		const sourceProjects = await this.projectRepository.findByMediaId(
			sourceMediaId,
			tx,
		);
		if (sourceProjects.length > 0) {
			await this.projectRepository.addMediaBulk(
				newMediaId,
				sourceProjects.map((p: { id: string }) => p.id),
				tx,
			);
		}

		// 3. Characters
		const sourceCharacters = await this.characterRepository.findByMediaId(
			sourceMediaId,
			tx,
		);
		if (sourceCharacters.length > 0) {
			await this.characterRepository.addToMediaBulk(
				newMediaId,
				sourceCharacters.map((c: { id: string }) => ({ id: c.id })),
				"manual",
				tx,
			);
		}

		// 4. IPs
		const sourceIps = await this.ipRepository.findByMediaId(sourceMediaId, tx);
		if (sourceIps.length > 0) {
			await this.ipRepository.addMediaBulk(
				newMediaId,
				sourceIps.map((i: { id: string }) => ({ id: i.id })),
				"manual",
				tx,
			);
		}

		// 5. URLs
		const sourceUrls = await this.mediaRepository.getUrls(sourceMediaId, tx);
		if (sourceUrls.length > 0) {
			await this.mediaRepository.addUrls(
				newMediaId,
				sourceUrls.map((u: { url: string }) => u.url),
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
		const fullPath = path.join(connectionInfo.path, media.filePath);

		try {
			const metadata = await this.imageProcessor.extractMetadata(fullPath);

			this.logger.info(
				{
					mediaId: media.id,
					fullPath,
					tagsCount: metadata.tags.length,
					hasWorkflow: !!metadata.workflow,
					hasPrompt: !!metadata.prompt,
				},
				"[MediaService] extractAndUpdateMetadata result",
			);

			// Store generation info
			await this.mediaRepository.upsertGenerationInfo(
				media.id,
				typeof metadata.prompt === "object"
					? JSON.stringify(metadata.prompt)
					: (metadata.prompt as string | null),
				metadata.workflow as object | null,
			);

			// Store tags
			if (metadata.tags.length > 0) {
				await this.tagRepository.addTagsToMedia(
					media.id,
					metadata.tags,
					"comfyui_workflow",
				);
			}

			return await this.mediaRepository.getGenerationInfo(media.id);
		} catch (e) {
			this.logger.error(
				{ err: e, mediaId: media.id, fullPath },
				"[MediaService] extractAndUpdateMetadata FAILED",
			);
			return null;
		}
	}
}
